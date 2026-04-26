import { deletePatient, getPatients, savePatient } from './storage.js';

const reportFields = [
  'Base of Tongue',
  'Vallecula',
  'Lateral Pharyngeal Wall',
  'Posterior Pharyngeal Wall',
  'Epiglottis',
  'Aryepiglottic Folds',
  'Pyriform Sinus',
  'Arytenoid',
  'Vocal Cords',
  'False Vocal Cords',
];

const blankFindings = Object.fromEntries(reportFields.map((field) => [field, '']));
const REPORT_WIDTH = 816;
const REPORT_HEIGHT = 1056;

const samplePatient = {
  id: crypto.randomUUID(),
  name: 'John Doe',
  age: '56',
  address: 'Random street',
  examDate: todayInputValue(),
  findings: {
    ...blankFindings,
    Epiglottis: 'Normal shape and movement.',
    'Vocal Cords': 'Mobile bilaterally.',
  },
  diagnosis: '',
  advice: '',
  images: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let patients = [];
let selectedPatientId = null;
let activeTab = 'details';
let previewResizeHandlerAttached = false;

const app = document.querySelector('#app');

init();

async function init() {
  patients = await getPatients();
  if (patients.length === 0) {
    const saved = await savePatient(samplePatient);
    patients = [saved];
  }

  selectedPatientId = patients[0]?.id || null;
  render();
}

function render() {
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);

  app.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">Private clinic tool</p>
        <h1>Clinic Report Studio</h1>
      </div>
      <div class="topbar-actions">
        <button class="ghost-button" data-action="new-patient">New Patient</button>
        <button class="primary-button" data-action="print-report" ${selectedPatient ? '' : 'disabled'}>
          Print / Save PDF
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="patient-panel">
        <div class="panel-heading">
          <h2>Patients</h2>
          <span>${patients.length}</span>
        </div>
        <div class="patient-list">
          ${renderPatientList()}
        </div>
      </aside>

      <section class="editor-panel">
        ${
          selectedPatient
            ? renderEditor(selectedPatient)
            : '<div class="empty-state">Create a patient profile to begin.</div>'
        }
      </section>
    </main>
  `;

  bindEvents();
  updateReportPreviewScale();
}

function renderPatientList() {
  if (patients.length === 0) {
    return '<p class="muted">No patient profiles yet.</p>';
  }

  return patients
    .map((patient) => {
      const isActive = patient.id === selectedPatientId ? 'active' : '';
      return `
        <button class="patient-row ${isActive}" data-patient-id="${patient.id}">
          <strong>${escapeHtml(patient.name || 'Unnamed patient')}</strong>
          <span>${escapeHtml(patient.age || '-')} years</span>
        </button>
      `;
    })
    .join('');
}

function renderEditor(patient) {
  return `
    <div class="editor-header">
      <div>
        <p class="eyebrow">Current report</p>
        <h2>${escapeHtml(patient.name || 'Unnamed patient')}</h2>
      </div>
      <button class="danger-button" data-action="delete-patient">Delete</button>
    </div>

    <nav class="tabs" aria-label="Report sections">
      ${renderTabButton('details', 'Details')}
      ${renderTabButton('findings', 'Findings')}
      ${renderTabButton('images', 'Images')}
      ${renderTabButton('preview', 'Preview')}
    </nav>

    <div class="tab-surface">
      ${renderActiveTab(patient)}
    </div>
  `;
}

function renderTabButton(tab, label) {
  return `
    <button class="tab-button ${activeTab === tab ? 'active' : ''}" data-tab="${tab}">
      ${label}
    </button>
  `;
}

function renderActiveTab(patient) {
  if (activeTab === 'findings') return renderFindings(patient);
  if (activeTab === 'images') return renderImages(patient);
  if (activeTab === 'preview') return renderReport(patient);
  return renderDetails(patient);
}

function renderDetails(patient) {
  return `
    <form class="form-grid" data-form="details">
      <label>
        Patient name
        <input name="name" value="${escapeAttribute(patient.name)}" autocomplete="off" required />
      </label>
      <label>
        Age
        <input name="age" value="${escapeAttribute(patient.age)}" inputmode="numeric" required />
      </label>
      <label class="wide">
        Address
        <textarea name="address" rows="3" required>${escapeHtml(patient.address)}</textarea>
      </label>
      <label>
        Examination date
        <input name="examDate" type="date" value="${escapeAttribute(patient.examDate || todayInputValue())}" />
      </label>
      <div class="form-actions wide">
        <button class="primary-button" type="submit">Save Details</button>
      </div>
    </form>
  `;
}

function renderFindings(patient) {
  return `
    <form class="findings-form" data-form="findings">
      ${reportFields
        .map(
          (field) => `
            <label>
              ${field}
              <textarea name="${escapeAttribute(field)}" rows="2">${escapeHtml(
                patient.findings?.[field] || '',
              )}</textarea>
            </label>
          `,
        )
        .join('')}
      <label>
        Diagnosis
        <textarea name="diagnosis" rows="3">${escapeHtml(patient.diagnosis || '')}</textarea>
      </label>
      <label>
        Advice
        <textarea name="advice" rows="3">${escapeHtml(patient.advice || '')}</textarea>
      </label>
      <div class="form-actions">
        <button class="primary-button" type="submit">Save Findings</button>
      </div>
    </form>
  `;
}

function renderImages(patient) {
  const remaining = Math.max(0, 4 - patient.images.length);

  return `
    <div class="image-tools">
      <label class="upload-zone ${remaining === 0 ? 'disabled' : ''}">
        <input type="file" accept="image/*" multiple ${remaining === 0 ? 'disabled' : ''} />
        <span>Add Images</span>
        <small>${remaining} slot${remaining === 1 ? '' : 's'} remaining</small>
      </label>
    </div>
    <div class="image-grid">
      ${
        patient.images.length
          ? patient.images
              .map(
                (image, index) => `
                  <figure class="image-tile">
                    <img src="${image.dataUrl}" alt="${escapeAttribute(image.name)}" />
                    <figcaption>
                      <span>${escapeHtml(image.name)}</span>
                      <button class="icon-button" data-remove-image="${index}" aria-label="Remove image">Remove</button>
                    </figcaption>
                  </figure>
                `,
              )
              .join('')
          : '<p class="empty-state">Add up to four laryngoscopy images for the report.</p>'
      }
    </div>
  `;
}

function renderReport(patient) {
  return `
    <div class="report-preview-frame">
      <article class="report-sheet" id="report-sheet">
        <header class="report-doctor">
          <h2>Dr. Sujeet Kumar Jethaliya</h2>
          <p>Video Laryngoscopy / Fibre Optics Laryngoscopy Report</p>
        </header>

        <section class="report-meta">
          <div>
            <p><strong>Patient's name:</strong> ${escapeHtml(patient.name)}</p>
            <p><strong>Patient's age:</strong> ${escapeHtml(patient.age)}</p>
            <p><strong>Patient's address:</strong> ${escapeHtml(patient.address)}</p>
          </div>
          <p><strong>Date:</strong> ${formatDate(patient.examDate)}</p>
        </section>

        <section class="report-body">
          <div class="report-findings">
            ${reportFields
              .map(
                (field) => `
                  <p><strong>${field}:</strong> ${escapeHtml(patient.findings?.[field] || '')}</p>
                `,
              )
              .join('')}
            <p class="report-space"><strong>Diagnosis:</strong> ${escapeHtml(patient.diagnosis || '')}</p>
            <p class="report-space"><strong>Advice:</strong> ${escapeHtml(patient.advice || '')}</p>
          </div>
          <div class="report-images image-count-${patient.images.length}">
            ${patient.images.map((image) => `<img src="${image.dataUrl}" alt="${escapeAttribute(image.name)}" />`).join('')}
          </div>
        </section>

        <footer class="report-footer">
          <p>Dr. S. K. Jethaliya</p>
          <p>MBBS, MS</p>
        </footer>
      </article>
    </div>
  `;
}

function bindEvents() {
  document.querySelector('[data-action="new-patient"]')?.addEventListener('click', createPatient);
  document.querySelector('[data-action="print-report"]')?.addEventListener('click', printReport);
  document.querySelector('[data-action="delete-patient"]')?.addEventListener('click', removeSelectedPatient);

  document.querySelectorAll('[data-patient-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedPatientId = button.dataset.patientId;
      activeTab = 'details';
      render();
    });
  });

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      render();
    });
  });

  document.querySelector('[data-form="details"]')?.addEventListener('submit', saveDetails);
  document.querySelector('[data-form="findings"]')?.addEventListener('submit', saveFindings);
  document.querySelector('input[type="file"]')?.addEventListener('change', addImages);

  document.querySelectorAll('[data-remove-image]').forEach((button) => {
    button.addEventListener('click', () => removeImage(Number(button.dataset.removeImage)));
  });

  if (!previewResizeHandlerAttached) {
    window.addEventListener('resize', updateReportPreviewScale);
    previewResizeHandlerAttached = true;
  }
}

function updateReportPreviewScale() {
  const frame = document.querySelector('.report-preview-frame');
  if (!frame) return;

  const surface = document.querySelector('.tab-surface');
  const availableWidth = surface?.clientWidth || window.innerWidth;
  const scale = Math.min(1, availableWidth / REPORT_WIDTH);

  frame.style.setProperty('--preview-scale', scale.toFixed(4));
  frame.style.width = `${REPORT_WIDTH * scale}px`;
  frame.style.height = `${REPORT_HEIGHT * scale}px`;
}

async function createPatient() {
  const patient = await savePatient({
    id: crypto.randomUUID(),
    name: 'New Patient',
    age: '',
    address: '',
    examDate: todayInputValue(),
    findings: { ...blankFindings },
    diagnosis: '',
    advice: '',
    images: [],
  });

  patients = await getPatients();
  selectedPatientId = patient.id;
  activeTab = 'details';
  render();
}

async function saveDetails(event) {
  event.preventDefault();
  const patient = selectedPatient();
  const formData = new FormData(event.currentTarget);

  await updatePatient({
    ...patient,
    name: formData.get('name').trim(),
    age: formData.get('age').trim(),
    address: formData.get('address').trim(),
    examDate: formData.get('examDate') || todayInputValue(),
  });
}

async function saveFindings(event) {
  event.preventDefault();
  const patient = selectedPatient();
  const formData = new FormData(event.currentTarget);
  const findings = {};

  reportFields.forEach((field) => {
    findings[field] = formData.get(field).trim();
  });

  await updatePatient({
    ...patient,
    findings,
    diagnosis: formData.get('diagnosis').trim(),
    advice: formData.get('advice').trim(),
  });
}

async function addImages(event) {
  const patient = selectedPatient();
  const files = Array.from(event.target.files || []).slice(0, 4 - patient.images.length);
  const images = await Promise.all(files.map(fileToImage));

  await updatePatient({
    ...patient,
    images: [...patient.images, ...images].slice(0, 4),
  });
}

async function removeImage(index) {
  const patient = selectedPatient();
  await updatePatient({
    ...patient,
    images: patient.images.filter((_, imageIndex) => imageIndex !== index),
  });
}

async function removeSelectedPatient() {
  const patient = selectedPatient();
  const shouldDelete = confirm(`Delete ${patient.name || 'this patient'}?`);
  if (!shouldDelete) return;

  await deletePatient(patient.id);
  patients = await getPatients();
  selectedPatientId = patients[0]?.id || null;
  activeTab = 'details';
  render();
}

function printReport() {
  activeTab = 'preview';
  render();
  requestAnimationFrame(() => window.print());
}

async function updatePatient(patient) {
  await savePatient(patient);
  patients = await getPatients();
  selectedPatientId = patient.id;
  render();
}

function selectedPatient() {
  return patients.find((patient) => patient.id === selectedPatientId);
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN').format(date);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replaceAll('\n', ' ');
}
