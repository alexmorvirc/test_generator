import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ToastrService } from 'ngx-toastr';
import { collection, addDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../environments/environment';
import { getAuth } from 'firebase/auth';

interface Question {
  id: string | number;
  question: string;
  subject: string;
  difficulty: string;
  type: string;      
  topic?: string;    
  options?: {        
    a?: string;
    b?: string;
    c?: string;
    d?: string;
  };
}

@Component({
  selector: 'app-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './generator.component.html',
  styleUrls: ['./generator.component.scss']
})
export class GeneratorComponent {
  // === datos del formulario ===
  questionOptions = Array.from({ length: 101 }, (_, i) => i);
  subject         = '';
  selectedTopic   = '';
  totalQuestions: number | null = null;
  numFour:      number | null = null;
  numDev:       number | null = null;
  numEasy:      number | null = null;
  numMedium:    number | null = null;
  numHard:      number | null = null;

  topicOptions: string[] = [];
  /*
   * Os he añadido 'subjectOptions'. Anteriormente, las asignaturas en el formulario eran estáticas.
   * Ahora, esta propiedad se poblará dinámicamente con las asignaturas únicas leídas del archivo Excel.
   * Esto mejora la flexibilidad de la aplicación, permitiendo que nuevas asignaturas se reconozcan
   * y se muestren en el selector sin requerir modificaciones en el código.
   */
  subjectOptions: string[] = []; // Almacena las asignaturas únicas extraídas del Excel
  questions:    Question[] = [];
  excelLoaded   = false;

  constructor(private toastr: ToastrService) {}

  /*
   * He implementado esta función auxiliar, `normalizeString`, para estandarizar las cadenas de texto.
   * Su propósito es asegurar la consistencia en las comparaciones de texto (como asignaturas, temas y dificultad)
   * eliminando variaciones causadas por:
   * 1. Acentos (por ejemplo, 'matemáticas' se convierte en 'matematicas').
   * 2. Espacios en blanco iniciales o finales (por ejemplo, ' Tema 1 ' se convierte en 'Tema 1').
   * 3. Diferencias de mayúsculas/minúsculas (por ejemplo, 'MATEMÁTICAS' se convierte en 'matematicas').
   * Al aplicar esta normalización, garantizamos que las comparaciones sean precisas y robustas.
   */
  private normalizeString(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      this.toastr.info('No se seleccionó ningún archivo.', 'Información');
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const sheet = wb.SheetNames[0];
        if (!sheet) throw new Error('Sin hojas en el Excel');

        const raw = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheet], { defval: '' });
        // normalizar encabezados
        const norm = raw.map(r => {
          const o: any = {};
          Object.entries(r).forEach(([k, v]) => {
            const key = k.trim().toLowerCase().replace(/\s+/g, '_');
            o[key] = v;
          });
          return o;
        });

        this.questions = norm.map(item => {
          // He normalizado el tipo de pregunta para mejorar su robustez.
          // Por ejemplo, si el Excel contiene "4 respues ." o "4 respues...",
          // ahora se interpretará consistentemente como '4_respuestas' para la lógica de la aplicación.
          // Vuestro código anterior (simplificado):
          // let questionType = String(item.tipo_pregunta || '');
          let questionType = this.normalizeString(String(item.tipo_pregunta || ''));
          if (questionType.includes('4 respues')) {
            questionType = '4_respuestas';
          } else if (questionType.includes('desarrollo')) {
            questionType = 'desarrollo';
          }

          return {
            id:         item.id_pregunta || String(Date.now() + Math.random()),
            question:   String(item.enunciado || '').trim(), // Eliminamos espacios del enunciado.
            /*
             * Este es un cambio fundamental que he implementado. Anteriormente, los valores del Excel
             * con acentos (por ejemplo, "matemáticas") o espacios extra ("Matemáticas ")
             * no coincidían con los valores del formulario.
             * Ahora, aplico 'normalizeString' a la asignatura, dificultad y tema al leerlos del Excel.
             * Esto asegura que todos los datos estén estandarizados, permitiendo que las comparaciones
             * funcionen correctamente.
             * Vuestro código anterior para 'subject' (ejemplo):
             * subject: String(item.asignatura || '').toLowerCase(),
             */
            subject:    this.normalizeString(String(item.asignatura || '')),
            difficulty: this.normalizeString(String(item.nivel_dificultad || '')),
            type:       questionType,
            topic:      this.normalizeString(String(item.temas || '')),
            options: {
              a: item.opcion_a ? String(item.opcion_a).trim() : '',
              b: item.opcion_b ? String(item.opcion_b).trim() : '',
              c: item.opcion_c ? String(item.opcion_c).trim() : '',
              d: item.opcion_d ? String(item.opcion_d).trim() : ''
            }
          };
        });

        /*
         * Os he incluido este bloque de `console.log` para depuración.
         * Muestra cómo quedan las preguntas después de ser parseadas y normalizadas desde el Excel.
         * Esto es muy útil para verificar que los datos se cargan correctamente.
         * Podéis comentarlo o eliminarlo una vez que hayáis confirmado su correcto funcionamiento.
         */
        /*console.log('--- Preguntas parseadas después de la carga del Excel ---');
        this.questions.forEach((q, index) => {
          console.log(`[${index}] ID: ${q.id}, Asignatura: '${q.subject}', Tipo: '${q.type}', Dificultad: '${q.difficulty}', Tema: '${q.topic}'`);
        });
        console.log('---------------------------------------------------------');*/


        // extraer temas únicos no vacíos
        // Similar a las asignaturas, he normalizado los temas para asegurar que las opciones del selector sean consistentes.
        // Vuestro código anterior:
        // this.topicOptions = Array.from(
        //   new Set(this.questions.map(q => q.topic).filter((t): t is string => !!t))
        // );
        this.topicOptions = Array.from(
          new Set(this.questions.map(q => this.normalizeString(q.topic || '')).filter((t): t is string => !!t))
        );

        /*
         * Aquí es donde recojo todas las asignaturas únicas de las preguntas recién leídas del Excel.
         * Utilizo 'normalizeString' para evitar duplicados causados por tildes o espacios.
         * Esta lista, 'subjectOptions', es la que utilizaremos en el HTML para poblar el desplegable de asignaturas,
         * haciendo que la aplicación sea dinámica y no dependa de un listado fijo.
         */
        this.subjectOptions = Array.from(
          new Set(this.questions.map(q => this.normalizeString(q.subject || '')).filter((s): s is string => !!s))
        );
        console.log('--- Asignaturas detectadas (normalizadas):', this.subjectOptions);


        if (!this.questions.length) {
          this.toastr.info('No hay preguntas en el Excel.', 'Excel vacío');
          return;
        }
        this.excelLoaded = true;
        this.toastr.success(`Cargadas ${this.questions.length} preguntas.`, 'OK');
      } catch (err: any) {
        console.error(err);
        this.toastr.error('Error procesando Excel.', 'Error');
      }
    };
    reader.onerror = () => this.toastr.error('Error leyendo Excel.', 'Error');
    reader.readAsArrayBuffer(file);
  }

  async generateTest(): Promise<void> {
    // 1) Validaciones
    // Este bloque de validaciones es vuestro y funciona correctamente.
    if (!this.excelLoaded) {
      this.toastr.warning('Añade primero un Excel.', 'Falta archivo');
      return;
    }
    if (!this.subject || !this.selectedTopic || this.totalQuestions == null
      || this.numFour == null || this.numDev == null
      || this.numEasy == null || this.numMedium == null || this.numHard == null) {
      this.toastr.warning('Completa todos los campos.', 'Formulario incompleto');
      return;
    }

    // 2) Las sumas deben coincidir
    // Estas comprobaciones de sumas también son vuestras y son correctas.
    const sumaTipos = this.numFour + this.numDev;
    const sumaDif   = this.numEasy + this.numMedium + this.numHard;
    if (sumaTipos !== this.totalQuestions) {
      this.toastr.error('4-respuestas + desarrollo ≠ total.', 'Error conteo');
      return;
    }
    if (sumaDif !== this.totalQuestions) {
      this.toastr.error('Suma por dificultad ≠ total.', 'Error conteo');
      return;
    }

    // 3) Usuario
    // La verificación del usuario es vuestra y es un paso importante para la autenticación de Firebase.
    const user = getAuth().currentUser;
    if (!user) {
      this.toastr.error('Error', 'No has iniciado sesión');
      return;
    }

    // 4) Función para pick aleatorio
    const pick = (type: string, diff: string, count: number) => {
      /*
       * Antes de aplicar los filtros, normalizo los valores seleccionados por el usuario en el formulario
       * (asignatura, tema, dificultad). Esto es crucial para que coincidan con los datos de las preguntas
       * que ya hemos normalizado al cargarlas del Excel.
       * Vuestro código anterior (ejemplo para 'subject'):
       * const pool = this.questions.filter(q =>
       * q.subject.toLowerCase() === this.subject.toLowerCase()
       * // ... otras condiciones
       * );
       */
      const normalizedSubject = this.normalizeString(this.subject);
      const normalizedSelectedTopic = this.normalizeString(this.selectedTopic);
      const normalizedDiff = this.normalizeString(diff);

      /*
       * Este es un bloque de depuración detallado.
       * Muestra los valores que se están utilizando para el filtro y los compara
       * con los atributos de cada pregunta. Si una pregunta no se selecciona,
       * este log os indicará exactamente cuál de las condiciones del filtro no se cumple.
       * Podéis eliminarlo una vez que la funcionalidad esté verificada.
       */
      console.log(`\n--- Intentando seleccionar preguntas ---`);
      console.log(`Parámetros de pick: Tipo='${type}', Dificultad='${diff}', Cantidad=${count}`);
      console.log(`Valores del formulario (normalizados): Asignatura='${normalizedSubject}', Tema='${normalizedSelectedTopic}'`);
      console.log(`----------------------------------------`);

      const pool = this.questions.filter(q => {
        // Todas las comparaciones ahora utilizan los valores normalizados para asegurar la coincidencia.
        const subjectMatch = q.subject === normalizedSubject;
        const typeMatch = q.type === type; // El tipo ya se normaliza al cargar
        const difficultyMatch = q.difficulty === normalizedDiff;
        const topicMatch = q.topic === normalizedSelectedTopic;

        // Log de cada condición de filtro para depuración.
        console.log(`  Pregunta ID: ${q.id || 'N/A'}`);
        console.log(`    Asignatura: '${q.subject}' (Esperado: '${normalizedSubject}') -> ${subjectMatch}`);
        console.log(`    Tipo:       '${q.type}' (Esperado: '${type}') -> ${typeMatch}`);
        console.log(`    Dificultad: '${q.difficulty}' (Esperado: '${normalizedDiff}') -> ${difficultyMatch}`);
        console.log(`    Tema:       '${q.topic}' (Esperado: '${normalizedSelectedTopic}') -> ${topicMatch}`);
        console.log(`    Coincidencia total para esta pregunta: ${subjectMatch && typeMatch && difficultyMatch && topicMatch}`);

        return subjectMatch && typeMatch && difficultyMatch && topicMatch;
      });
      console.log(`--- Tamaño del pool para Tipo='${type}', Dificultad='${diff}': ${pool.length} ---`);

      /*
       * He corregido un error importante aquí: la variable 'arr' no estaba definida,
       * lo que impedía que el código para desordenar las preguntas funcionara correctamente.
       * Ahora, creo una copia del 'pool' de preguntas encontradas en 'arr' para poder mezclarlas
       * sin afectar el array original.
       * Vuestro código anterior (que causaba el error "arr is not defined"):
       * for (let i = arr.length - 1; i > 0; i--) {
       * const j = Math.floor(Math.random() * (i + 1));
       * [arr[i], arr[j]] = [arr[j], arr[i]];
       * }
       */
      const arr = [...pool]; // Solución: Copiar el pool a 'arr' para permitir la mezcla.
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.slice(0, count);
    };

    // 5) Formar array final
    // Este bloque para formar el array final es vuestro y está bien estructurado.
    const final: Question[] = [];
    final.push(...pick('4_respuestas', 'facil',   this.numEasy));
    final.push(...pick('4_respuestas', 'medio',   this.numMedium));
    final.push(...pick('4_respuestas', 'dificil', this.numHard));
    final.push(...pick('desarrollo',    'facil',   this.numDev));


    console.log('>>> FINAL QUESTIONS (Array final después de pick):', final);

    /*
     * Os he añadido esta validación para mejorar la experiencia del usuario.
     * Si después de aplicar todos los filtros no se encuentra ninguna pregunta,
     * se muestra una advertencia clara. Esto evita que el usuario se quede sin saber por qué
     * no se genera el test y previene intentos de guardar documentos o generar PDFs vacíos.
     */
    if (final.length === 0) {
      this.toastr.warning('No se encontraron preguntas con los filtros seleccionados.', 'Sin resultados');
      return;
    }

    // 6) Guardar en Firestore
    const docRef = await addDoc(collection(db, 'tests'), {
      userId:         user.uid,
      userEmail:      user.email,
      /*
       * Para el almacenamiento en Firestore y la generación del PDF,
       * he optado por usar los valores originales que el usuario seleccionó en el formulario
       * (this.subject, this.selectedTopic). Aunque para los filtros internos utilizamos
       * los valores normalizados, aquí es preferible mantener la información tal como
       * se presentó al usuario para mayor claridad en los registros.
       * Vuestro código anterior (que ya era correcto en este aspecto):
       * subject: this.subject,
       * topic: this.selectedTopic,
       */
      subject:        this.subject,
      topic:          this.selectedTopic,
      totalQuestions: this.totalQuestions,
      createdAt:      Timestamp.now(),
      questions:      final.map(q => ({
        enunciado: q.question,
        opciones:  q.options || {}
      }))
    });

    // 7) Recuperar y generar PDF
    // Este bloque para recuperar los datos y generar el PDF es vuestro y funciona correctamente.
    const snap = await getDoc(docRef);
    const data = snap.data()!;// El '!' asegura que TypeScript confía en que 'data' no será undefined.
    this.createPDF(data['questions'] as any[], String(data['subject']));
  }

  private createPDF(questions: any[], subject: string) {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(`Test Generado – Asignatura: ${subject}`, 14, 20);

    let y = 40;
    questions.forEach((q, i) => {
      if (y > 260) { pdf.addPage(); y = 20; }
      pdf.setFont('helvetica', 'bold')

         .text(`${i + 1}. ${q.enunciado}`, 14, y, { maxWidth: 180 });
      y += 8;
      /*
       * He añadido una comprobación para las opciones de respuesta.
       * Como las preguntas de "desarrollo" no tienen opciones, para evitar errores
       * y hacer el código más robusto, ahora solo se iteran y muestran las opciones
       * si la pregunta realmente las tiene (es decir, si 'q.opciones' existe y no está vacío).
       * Vuestro código anterior (que intentaba iterar siempre):
       * Object.entries(q.opciones).forEach(([k, v]) => {
       * if (v) {
       * pdf.setFont('helvetica', 'normal')
       * .text(`${k.toUpperCase()}. ${v}`, 20, y, { maxWidth: 170 });
       * y += 6;
       * }
       * });
       */
      if (q.opciones && Object.keys(q.opciones).length > 0) {
        Object.entries(q.opciones).forEach(([k, v]) => {
          if (v) {
            pdf.setFont('helvetica', 'normal')
              .text(`${k.toUpperCase()}. ${v}`, 20, y, { maxWidth: 170 });

            y += 6;
          }
        });
      }
      y += 10;
      pdf.setDrawColor(200);
      pdf.line(14, y, 196, y);
      y += 10;
    });

    pdf.save(`test-${subject}-${Date.now()}.pdf`);
  }
}

// Función para mezclar un array aleatoriamente (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
