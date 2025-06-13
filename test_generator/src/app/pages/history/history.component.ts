//Importaciones
import { Component, OnInit } from '@angular/core'; // Component para el decorador, OnInit para el ciclo de vida ngOnInit.
import { CommonModule } from '@angular/common'; // Para usar directivas como *ngFor en el HTML asociado.
import { collection, getDocs, query, orderBy, doc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore'; // Añado funciones para actualizar documentos
import { db } from '../../environments/environment'; // Importa la instancia 'db' de Firestore inicializada en tu archivo de entorno.
import { storage } from '../../environments/environment';
import { ref as storageRef, deleteObject } from 'firebase/storage'; // Importa funciones de Firebase Storage para manejar archivos (storageRef y deleteObject).
import { FormsModule } from '@angular/forms'; //FormsModule para usar formularios reactivos y directivas como ngModel en el HTML.
import jsPDF from 'jspdf'; // Importación para generar PDFs
import autoTable from 'jspdf-autotable'; // Opcional, si quieres usar tablas en el PDF
import { getAuth } from 'firebase/auth'; // Para obtener el usuario actual autenticado

interface TestHistoryItem{
  id: string; // ID del documento en Firestore.
  username: string; // Nombre de usuario asociado al test.
  dateTime: Date; // Fecha y hora en que se creó el test.
  subject: string; // Asignatura del test.
  numberOfQuestions: number; // Número total de preguntas en el test.
  fileUrl: string; // URL del archivo PDF del test almacenado en Firebase Storage.
  fileName: string; // Nombre del archivo PDF para la descarga.
  isFavorite: boolean; // Propiedad para marcar si el test es favorito
  favoritedBy?: string[]; // Array de IDs de usuarios que han marcado este test como favorito
}

@Component({
  selector: 'app-history', // Nombre del selector HTML para usar este componente.
  standalone: true, // Indica que este componente es independiente y no necesita un módulo específico.
  imports: [CommonModule, FormsModule], // Importa CommonModule para poder usar directivas comunes en el template.
  templateUrl: './history.component.html', // Ruta al archivo HTML de este componente.
  styleUrl: './history.component.scss' // Ruta al archivo SCSS de estilos para este componente.
})

// Implementa 'OnInit' para usar el "gancho" (hook) del ciclo de vida ngOnInit.
export class HistoryComponent implements OnInit {

  allTests: TestHistoryItem[] = []; // Propiedad para almacenar todos los tests recuperados de Firestore.
  // Propiedad para almacenar la lista de tests recuperados de Firestore.
  tests: TestHistoryItem[] = []; // Inicialmente vacío, se llenará con los datos de Firestore.

  // Propiedad para indicar si se están cargando los datos (útil para mostrar un spinner/mensaje en el HTML).
  isLoading: boolean = false;

  // Propiedades para los filtros
  availableUsers: string[] = []; // Lista de usuarios disponibles para filtrar.
  availableSubjects: string[] = []; // Lista de asignaturas disponibles para filtrar.
  questionNumberOptions: number[] = []; // Lista de opciones para el número de preguntas (ej: 5, 10, 15, etc.).

  // Modelos para los ngModel de los filtros en HTML.
  selectedUser: string = 'Todos'; // Usuario seleccionado para filtrar.
  selectedDate: string = ''; // Fecha seleccionada para filtrar.
  selectedSubject: string = 'Todos'; // Asignatura seleccionada para filtrar.
  selectedNumberOfQuestions: string | number = 'Todos'; // Número de preguntas seleccionado para filtrar.
  showOnlyFavorites: boolean = false; // Para mostrar solo favoritos
  currentUserId: string = ''; // ID del usuario actual autenticado

  // El constructor. Se ejecuta al crear el componente. Ideal para inyectar dependencias.
  // Actualmente está vacío, pero si necesitaras servicios (como ToastrService), los inyectarías aquí.
  constructor() { 
    // Obtener el ID del usuario actual
    const auth = getAuth();
    this.currentUserId = auth.currentUser?.uid || '';
    console.log('Constructor - Usuario autenticado:', auth.currentUser?.email, 'ID:', this.currentUserId);
  }

  // ngOnInit es un método especial que Angular llama automáticamente UNA VEZ después de
  // que el componente ha sido inicializado y sus propiedades de entrada (@Input) han sido establecidas.
  // Es el lugar ideal para realizar llamadas iniciales para cargar datos.
  ngOnInit(): void {
    // Llama al método que carga el historial de tests desde Firestore.
    this.loadTestHistory();
    // Opciones para el filtro de número de preguntas.
    for (let i = 1; i <= 25; i++) {
      this.questionNumberOptions.push(i);
    }

    // Si el usuario no está autenticado, intentar obtener el ID de nuevo
    if (!this.currentUserId) {
      const auth = getAuth();
      if (auth.currentUser) {
        this.currentUserId = auth.currentUser.uid;
        console.log('Usuario autenticado:', auth.currentUser.email);
      } else {
        console.log('No hay usuario autenticado actualmente');
        // Suscribirse al cambio de estado de autenticación
        auth.onAuthStateChanged((user) => {
          if (user) {
            this.currentUserId = user.uid;
            console.log('Usuario autenticado en onAuthStateChanged:', user.email);
            // Recargar para reflejar el estado de favoritos del usuario
            this.loadTestHistory();
          } else {
            this.currentUserId = '';
            console.log('Usuario desconectado en onAuthStateChanged');
          }
        });
      }
    }
  }

  // Método ASÍNCRONO (async) para cargar los datos desde Firestore.
  // Usar async/await hace que el código sea más fácil de leer que usar .then() con Promesas.
  async loadTestHistory(): Promise<void> {
    this.isLoading = true; // Marcar como 'cargando' para mostrar un indicador en el HTML.
    console.log('Cargando historial de tests...');

    try {
      // Busca el registro. La forma moderna y recomendada de consultar Firestore en la nueva v9 Web SDK.
      // Colección 'tests' y ordenamiento por fecha descendente (más reciente primero).
      const testsCollection = collection(db, 'tests'); // Obtener la colección 'tests'.
      
      // Intentar primero sin orderBy para ver si hay documentos
      const simpleQuery = query(testsCollection);
      const querySnapshot = await getDocs(simpleQuery);
      
      console.log(`Se encontraron ${querySnapshot.size} documentos en la colección 'tests'`);

      this.allTests = []; // Vaciar el array antes de llenarlo con nuevos datos.
      this.availableUsers = ['Todos']; // Reiniciar las opciones de filtro.
      this.availableSubjects = ['Todos'];

      // Recorrer cada documento devuelto por la consulta.
      querySnapshot.forEach((doc) => {
        // Datos del documento y su ID.
        const data = doc.data();
        const id = doc.id;
        
        console.log('Documento encontrado:', id, data);

        // Determinar los campos correctos según la estructura real de Firestore
        // Intentar con diferentes nombres de campos posibles
        let dateTimeValue;
        if (data['dateTime']) {
          dateTimeValue = data['dateTime'];
        } else if (data['createdAt']) {
          dateTimeValue = data['createdAt'];
        } else {
          dateTimeValue = new Date();
        }

        // Convertir la marca de tiempo Firestore a un objeto Date de JavaScript.
        const dateTime = dateTimeValue.seconds ? new Date(dateTimeValue.seconds * 1000) : new Date();

        // Verificar si el test es favorito para el usuario actual
        const favoritedBy = data['favoritedBy'] || [];
        const isFavorite = this.currentUserId ? favoritedBy.includes(this.currentUserId) : false;

        // Crear un objeto con los datos estructurados, contemplando diferentes nombres de campos posibles
        const testItem: TestHistoryItem = {
          id,
          username: data['username'] || data['userEmail'] || data['user'] || 'Desconocido',
          dateTime,
          subject: data['subject'] || data['materia'] || data['asignatura'] || 'Sin materia',
          numberOfQuestions: data['numberOfQuestions'] || data['totalQuestions'] || data['numQuestions'] || 0,
          fileUrl: data['fileUrl'] || data['pdfUrl'] || data['url'] || '',
          fileName: data['fileName'] || data['pdfName'] || data['name'] || '',
          isFavorite: isFavorite,
          favoritedBy: favoritedBy
        };

        console.log('Test procesado:', testItem);

        // Añadir el test a la lista.
        this.allTests.push(testItem);

        // Añadir el usuario y la materia a las listas de opciones disponibles para filtrado, si no existen ya.
        if (testItem.username && !this.availableUsers.includes(testItem.username)) {
          this.availableUsers.push(testItem.username);
        }
        if (testItem.subject && !this.availableSubjects.includes(testItem.subject)) {
          this.availableSubjects.push(testItem.subject);
        }
      });

      console.log('Tests cargados:', this.allTests.length);
      console.log('Usuarios disponibles:', this.availableUsers);
      console.log('Materias disponibles:', this.availableSubjects);

      // Aplicar los filtros para inicializar la vista.
      this.applyFilters();
      console.log('Tests filtrados:', this.tests.length);

    } catch (error) {
      console.error('Error al cargar el historial de tests:', error);
      // Aquí podrías mostrar un mensaje de error al usuario (ej: con Toastr).
      // this.toastr.error('No se pudo cargar el historial. Inténtalo más tarde.', 'Error');
    } finally {
      this.isLoading = false; // Marcar como 'ya no cargando' independientemente del resultado.
    }
  }

  // Método para aplicar los filtros seleccionados por el usuario.
  applyFilters(): void {
    // Iniciar con todos los tests.
    let filteredTests = [...this.allTests];

    // Filtrar por usuario si no es 'Todos'.
    if (this.selectedUser !== 'Todos') {
      filteredTests = filteredTests.filter(test => test.username === this.selectedUser);
    }

    // Filtrar por fecha si se ha seleccionado una.
    if (this.selectedDate) {
      // Convertir la fecha seleccionada a un objeto Date para comparar solo la fecha (sin hora).
      const selectedDate = new Date(this.selectedDate);
      // Necesitas comparar solo la parte de la fecha, no la hora.
      filteredTests = filteredTests.filter(test => {
        // Crear fechas sin tiempo para comparar solo la fecha.
        const testDate = new Date(test.dateTime);
        testDate.setHours(0, 0, 0, 0);
        const compareDate = new Date(selectedDate);
        compareDate.setHours(0, 0, 0, 0);
        return testDate.getTime() === compareDate.getTime();
      });
    }

    // Filtrar por materia si no es 'Todos'.
    if (this.selectedSubject !== 'Todos') {
      filteredTests = filteredTests.filter(test => test.subject === this.selectedSubject);
    }

    // Filtrar por número de preguntas si no es 'Todos'.
    if (this.selectedNumberOfQuestions !== 'Todos') {
      const numQuestions = typeof this.selectedNumberOfQuestions === 'string' 
        ? parseInt(this.selectedNumberOfQuestions, 10) 
        : this.selectedNumberOfQuestions;
      filteredTests = filteredTests.filter(test => test.numberOfQuestions === numQuestions);
    }

    // Filtrar solo favoritos si está activado
    if (this.showOnlyFavorites) {
      filteredTests = filteredTests.filter(test => test.isFavorite);
    }

    // Actualizar la lista de tests mostrada.
    this.tests = filteredTests;
  }

  // Método para limpiar/reiniciar todos los filtros.
  clearFilters(): void {
    this.selectedUser = 'Todos';
    this.selectedDate = '';
    this.selectedSubject = 'Todos';
    this.selectedNumberOfQuestions = 'Todos';
    this.showOnlyFavorites = false;
    this.applyFilters(); // Aplicar los filtros (ahora resetados).
  }

  // Método para marcar/desmarcar un test como favorito
  async toggleFavorite(test: TestHistoryItem): Promise<void> {
    console.log('Intentando marcar/desmarcar favorito para test:', test.id);
    
    // Verificar la autenticación nuevamente
    const auth = getAuth();
    this.currentUserId = auth.currentUser?.uid || '';
    
    // Validar que el usuario está autenticado
    if (!this.currentUserId) {
      console.error('Usuario no autenticado. No se puede marcar como favorito.');
      alert('Necesitas iniciar sesión para marcar tests como favoritos.');
      return;
    }

    try {
      this.isLoading = true;
      console.log('Obteniendo referencia al documento:', test.id);
      const testDocRef = doc(db, 'tests', test.id);
      
      // Invertir el estado de favorito
      const isFavorite = !test.isFavorite;
      console.log(`Cambiando estado a: ${isFavorite ? 'favorito' : 'no favorito'}`);
      
      // Crear o actualizar el campo favoritedBy si no existe
      let updateData: any = {};
      
      if (isFavorite) {
        // Añadir el ID del usuario al array de favoritedBy
        console.log('Añadiendo usuario a favoritedBy:', this.currentUserId);
        updateData.favoritedBy = arrayUnion(this.currentUserId);
      } else {
        // Quitar el ID del usuario del array de favoritedBy
        console.log('Quitando usuario de favoritedBy:', this.currentUserId);
        updateData.favoritedBy = arrayRemove(this.currentUserId);
      }
      
      console.log('Datos a actualizar:', updateData);
      await updateDoc(testDocRef, updateData);
      console.log('Documento actualizado correctamente');

      // Actualizar el estado local del test
      test.isFavorite = isFavorite;
      console.log('Estado local actualizado:', test.isFavorite);
      
      // Actualizar allTests para que los filtros funcionen correctamente
      const index = this.allTests.findIndex(t => t.id === test.id);
      if (index !== -1) {
        this.allTests[index].isFavorite = isFavorite;
      }

      // Replicar cambio en tests para actualizar la UI
      const testIndex = this.tests.findIndex(t => t.id === test.id);
      if (testIndex !== -1) {
        this.tests[testIndex].isFavorite = isFavorite;
      }

      console.log(`Test ${test.id} ${isFavorite ? 'marcado como' : 'desmarcado de'} favorito`);
    } catch (error) {
      console.error('Error al actualizar favorito:', error);
      alert('No se pudo actualizar el estado de favorito. Intenta nuevamente.');
    } finally {
      this.isLoading = false;
    }
  }

  // Función para iniciar la descarga de un PDF cuando el usuario hace clic en un botón/enlace en el HTML.
  // Recibe el objeto 'test' correspondiente a la fila en la que se hizo clic.
  // NOTA: El parámetro 'test: any' debería usar la interfaz que definas (ej: test: TestHistoryItem).
  async downloadTest(test: TestHistoryItem): Promise<void> {
    this.isLoading = true; // Mostrar indicador de carga
    
    try {
      // 1. Recuperar el documento completo de Firestore usando su ID
      const testDocRef = doc(db, 'tests', test.id);
      const testDoc = await getDoc(testDocRef);
      
      if (!testDoc.exists()) {
        console.error('El documento del test no existe en Firestore');
        // Si estás usando Toastr podrías añadir:
        // this.toastr.error('No se pudo encontrar el test en la base de datos', 'Error');
        return;
      }
      
      const testData = testDoc.data();
      
      // 2. Generar un nuevo PDF con los datos obtenidos
      const pdf = new jsPDF();
      pdf.setFontSize(16);
      pdf.text(`Test de ${test.subject}`, 14, 20);
      
      // Información adicional del test
      pdf.setFontSize(12);
      pdf.text(`Creado por: ${test.username}`, 14, 30);
      pdf.text(`Fecha: ${test.dateTime.toLocaleDateString()}`, 14, 38);
      pdf.text(`Preguntas: ${test.numberOfQuestions}`, 14, 46);
      
      let y = 60; // Posición vertical inicial para las preguntas
      
      // Iterar por las preguntas del test (si existen)
      if (testData['questions'] && Array.isArray(testData['questions'])) {
        testData['questions'].forEach((q: any, i: number) => {
          if (y > 260) { 
            pdf.addPage(); 
            y = 20; 
          }
          
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${i + 1}. ${q['enunciado']}`, 14, y, { maxWidth: 180 });
          y += 8;
          
          // Si hay opciones para la pregunta, mostrarlas
          if (q['opciones'] && Object.keys(q['opciones']).length > 0) {
            Object.entries(q['opciones']).forEach(([k, v]) => {
              if (v) {
                pdf.setFont('helvetica', 'normal');
                pdf.text(`${k.toUpperCase()}. ${v}`, 20, y, { maxWidth: 170 });
                y += 6;
              }
            });
          }
          
          y += 10;
          pdf.setDrawColor(200);
          pdf.line(14, y, 196, y);
          y += 10;
        });
      } else {
        pdf.text('No se encontraron preguntas en este test', 14, y);
      }
      
      // 3. Guardar y descargar el PDF
      pdf.save(`test-${test.subject}-${Date.now()}.pdf`);
      
      // Si estás usando Toastr podrías añadir:
      // this.toastr.success('Test descargado correctamente', 'Éxito');
      
    } catch (error) {
      console.error('Error al descargar el test:', error);
      // Si estás usando Toastr podrías añadir:
      // this.toastr.error('No se pudo descargar el test', 'Error');
    } finally {
      this.isLoading = false; // Ocultar indicador de carga
    }
  }

  async deleteTest(testToDelete: TestHistoryItem): Promise<void> {
    // 1. Confirmación del usuario (¡muy importante!)
    if (!confirm(`¿Estás seguro de que quieres eliminar el test "${testToDelete.fileName}" de ${testToDelete.username}? Esta acción no se puede deshacer.`)) {
      return; // El usuario canceló la acción
    }

    this.isLoading = true; // Mostrar indicador de carga

    try {
      // 2. Eliminar el documento de Firestore
      const testDocRef = doc(db, 'tests', testToDelete.id);
      await deleteDoc(testDocRef);
      console.log(`Documento ${testToDelete.id} eliminado de Firestore.`);

      // 3. Eliminar el archivo PDF de Firebase Storage (si existe fileUrl y fileName)
      if (testToDelete.fileUrl && testToDelete.fileName) {
        // Extraer el nombre del archivo de la URL puede ser complicado si la URL no es siempre la misma.
        // Es más seguro si el nombre del archivo está almacenado correctamente en Firestore (testToDelete.fileName)
        // y si la estructura de almacenamiento es conocida, por ej. 'tests_pdfs/${testToDelete.fileName}'
        // Si tu fileName en Firestore es el nombre completo con el que se guardó en Storage (ej: 'tests_pdfs/nombre_archivo.pdf'), úsalo directamente.
        // Si no, necesitas construir la ruta correcta.
        // Asumiendo que fileName es solo 'nombre_archivo.pdf' y están en una carpeta 'tests_pdfs':
        // const filePathInStorage = `tests_pdfs/${testToDelete.fileName}`; // Ajusta esta ruta si es necesario
        // Por ahora, intentaremos usar el fileName directamente si asumimos que es la ruta completa o solo el nombre del objeto en la raíz del bucket (o la ruta que usaste al subir)
        // La forma más robusta es tener la ruta completa de Storage o una referencia directa si es posible.
        // Si fileUrl es una URL de descarga, necesitas obtener la referencia de Storage a partir de ella o, mejor, guardar la ruta de Storage en Firestore.

        // Intento simplificado: si guardaste el archivo con un nombre específico (fileName) en la raíz o una carpeta conocida.
        // Si fileUrl es una URL de descarga HTTP y no una gs:// path, deleteObject con la URL HTTP fallará.
        // Necesitas la referencia de Firebase Storage.
        // Vamos a asumir que testToDelete.fileName es el nombre del archivo en Storage, y que no está en subcarpetas para este ejemplo simplificado.
        // En un caso real, deberías guardar la RUTA COMPLETA de storage en Firestore para una eliminación fiable.
        
        // Intento más robusto: Tratar de obtener la referencia desde la URL de descarga.
        // Esto solo funciona si la URL es una URL de descarga de Firebase Storage y tienes configurado Storage correctamente.
        try {
            const fileRef = storageRef(storage, testToDelete.fileUrl); // Intenta crear la referencia desde la URL
            await deleteObject(fileRef);
            console.log(`Archivo ${testToDelete.fileName} eliminado de Firebase Storage usando fileUrl.`);
        } catch (storageError) {
            console.warn(`No se pudo eliminar "${testToDelete.fileName}" de Storage usando fileUrl. Error: ${storageError}. Puede que el archivo no exista o la URL no sea una referencia directa de Storage. Intentando con fileName como ruta...`);
            // Plan B: Si testToDelete.fileName es la ruta en storage, como 'tests_pdfs/nombre_archivo.pdf'
            // O si al subirlo lo guardaste directamente con ese nombre en la raíz del bucket.
            // Esta parte es la más delicada y depende de cómo guardas los archivos.
            try {
                const fileRefByName = storageRef(storage, testToDelete.fileName); // Asume que fileName es la ruta/nombre en Storage.
                await deleteObject(fileRefByName);
                console.log(`Archivo ${testToDelete.fileName} eliminado de Firebase Storage usando fileName como ruta.`);
            } catch (e) {
                console.error(`Error definitivo al eliminar ${testToDelete.fileName} de Firebase Storage: ${e}. Puede que necesites ajustar la lógica de obtención de la referencia del archivo.`);
                // No relanzar el error necesariamente, el documento de Firestore ya fue eliminado.
                // Podrías notificar al usuario que el registro fue eliminado pero el archivo podría persistir.
            }
        }
      } else {
        console.warn(`No se intentó eliminar el archivo de Storage para ${testToDelete.id} porque fileUrl o fileName no están definidos.`);
      }

      // 4. Actualizar la UI: quitar el test de allTests y reaplicar filtros
      this.allTests = this.allTests.filter(test => test.id !== testToDelete.id);
      this.applyFilters(); // Reaplicar filtros para actualizar la vista 'this.tests'
      
      // Aquí podrías añadir una notificación de éxito (ej: con Toastr)
      // this.toastr.success('Test eliminado correctamente.');

    } catch (error) {
      console.error('Error al eliminar el test:', error);
      // Aquí podrías añadir una notificación de error (ej: con Toastr)
      // this.toastr.error('No se pudo eliminar el test. Inténtalo más tarde.', 'Error');
    } finally {
      this.isLoading = false; // Ocultar indicador de carga
    }
  }
 
}