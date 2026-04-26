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
const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN = 45;

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
let printHandlerAttached = false;

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
          Save PDF
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
            ${patient.images
              .map(
                (image) =>
                  `<img src="${image.dataUrl}" alt="${escapeAttribute(image.name)}" loading="eager" decoding="sync" />`,
              )
              .join('')}
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
    window.addEventListener('orientationchange', updateReportPreviewScale);
    window.visualViewport?.addEventListener('resize', updateReportPreviewScale);
    previewResizeHandlerAttached = true;
  }

  if (!printHandlerAttached) {
    window.addEventListener('beforeprint', prepareReportForPrint);
    printHandlerAttached = true;
  }
}

function updateReportPreviewScale() {
  const frame = document.querySelector('.report-preview-frame');
  if (!frame) return;

  const surface = document.querySelector('.tab-surface');
  const availableWidth = surface ? contentWidth(surface) : window.innerWidth;
  const scale = Math.min(1, availableWidth / REPORT_WIDTH);

  frame.style.setProperty('--preview-scale', scale.toFixed(4));
  frame.style.width = `${REPORT_WIDTH * scale}px`;
  frame.style.height = `${REPORT_HEIGHT * scale}px`;
}

function contentWidth(element) {
  const styles = getComputedStyle(element);
  const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  return Math.max(0, element.clientWidth - paddingX);
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

function prepareReportForPrint() {
  activeTab = 'preview';
  render();
  updateReportPreviewScale();
}

async function printReport() {
  const printButton = document.querySelector('[data-action="print-report"]');
  if (printButton) printButton.disabled = true;
  const pdfWindow = window.open('', '_blank');
  if (pdfWindow) {
    pdfWindow.document.write('<p style="font-family: system-ui, sans-serif;">Preparing PDF...</p>');
  }

  try {
    const patient = selectedPatient();
    if (!patient) return;
    const pdfBytes = await buildReportPdf(patient);
    downloadPdf(pdfBytes, `${patient.name || 'clinic-report'}.pdf`, pdfWindow);
  } finally {
    if (printButton) printButton.disabled = false;
  }
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

function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function waitForReportAssets() {
  const sheet = document.querySelector('#report-sheet');
  if (!sheet) return;

  const images = Array.from(sheet.querySelectorAll('img'));
  await Promise.all([waitForFonts(), ...images.map(waitForImage)]);
}

function waitForFonts() {
  if (!document.fonts?.ready) return Promise.resolve();
  return withTimeout(document.fonts.ready, 1200);
}

async function waitForImage(image) {
  if (!image.complete) {
    await withTimeout(
      new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      }),
      1200,
    );
  }

  if (!image.decode) return;

  try {
    await withTimeout(image.decode(), 1200);
  } catch {
    // Safari can reject decode() for already-rendered data URLs; printing can still proceed.
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

async function buildReportPdf(patient) {
  const pdf = new PdfBuilder();
  const content = [];
  const images = await Promise.all((patient.images || []).map((image) => preparePdfImage(image.dataUrl)));

  const page = {
    width: PDF_PAGE_WIDTH,
    height: PDF_PAGE_HEIGHT,
    margin: PDF_MARGIN,
  };

  let y = page.height - page.margin - 10;
  drawCenteredText(content, 'Dr. Sujeet Kumar Jethaliya', y, 20, 'F2', page.width);
  y -= 36;

  drawLabelValue(content, "Patient's name:", patient.name || '', page.margin, y, 15);
  drawText(content, `Date: ${formatDate(patient.examDate)}`, page.width - page.margin - 95, y, 15, 'F1');
  y -= 24;
  drawLabelValue(content, "Patient's age:", patient.age || '', page.margin, y, 15);
  y -= 24;
  drawLabelValue(content, "Patient's address:", patient.address || '', page.margin, y, 15);
  y -= 48;

  drawCenteredText(content, 'Video Laryngoscopy / Fibre Optics Laryngoscopy report', y, 17, 'F3', page.width);
  y -= 42;

  const imageIds = images.map((image, index) => pdf.addImage(`Im${index + 1}`, image.bytes, image.width, image.height));
  const imageHeight = images.length <= 3 ? 120 : 110;
  const imageX = page.width - page.margin - 150;
  let imageY = y;

  imageIds.forEach((imageId) => {
    drawImage(content, imageId.name, imageX, imageY - imageHeight + 10, 150, imageHeight);
    imageY -= imageHeight + 15;
  });

  const findingX = page.margin;
  reportFields.forEach((field) => {
    drawLabelValue(content, `${field}:`, patient.findings?.[field] || '', findingX, y, 15);
    y -= 24;
  });

  y -= 38;
  drawLabelValue(content, 'Diagnosis:', patient.diagnosis || '', findingX, y, 15);
  y -= 70;
  drawLabelValue(content, 'Advice:', patient.advice || '', findingX, y, 15);

  drawText(content, 'Dr. S. K. Jethaliya', page.width - page.margin - 125, page.margin + 28, 15, 'F1');
  drawText(content, 'MBBS, MS', page.width - page.margin - 70, page.margin + 10, 15, 'F1');

  pdf.addPage(content.join('\n'), imageIds);
  return pdf.build();
}

async function preparePdfImage(dataUrl) {
  const image = await loadImage(dataUrl);
  const targetWidth = 450;
  const targetHeight = 360;
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  const scale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (targetWidth - width) / 2;
  const y = (targetHeight - height) / 2;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, x, y, width, height);

  return {
    bytes: base64ToBytes(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]),
    width: targetWidth,
    height: targetHeight,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawText(commands, text, x, y, size, font = 'F1') {
  commands.push(`BT /${font} ${formatNumber(size)} Tf ${formatNumber(x)} ${formatNumber(y)} Td (${escapePdfText(text)}) Tj ET`);
}

function drawCenteredText(commands, text, y, size, font, pageWidth) {
  const x = (pageWidth - estimateTextWidth(text, size)) / 2;
  drawText(commands, text, x, y, size, font);
}

function drawLabelValue(commands, label, value, x, y, size) {
  drawText(commands, label, x, y, size, 'F2');
  drawText(commands, value, x + estimateTextWidth(label, size) + 4, y, size, 'F1');
}

function drawImage(commands, name, x, y, width, height) {
  commands.push(
    `q ${formatNumber(width)} 0 0 ${formatNumber(height)} ${formatNumber(x)} ${formatNumber(y)} cm /${name} Do Q`,
  );
}

function downloadPdf(bytes, filename, targetWindow) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  if (targetWindow) {
    targetWindow.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFilename(filename);
  link.target = '_blank';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function sanitizeFilename(value) {
  return value.replace(/[\\/:*?"<>|]+/g, '-');
}

function estimateTextWidth(text, size) {
  return String(text).length * size * 0.45;
}

function escapePdfText(value = '') {
  return String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

class PdfBuilder {
  constructor() {
    this.objects = [];
    this.fonts = {
      F1: this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>'),
      F2: this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>'),
      F3: this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>'),
    };
    this.pages = [];
  }

  addObject(content) {
    this.objects.push(content);
    return this.objects.length;
  }

  addImage(name, bytes, width, height) {
    const id = this.addObject({
      dictionary: `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>`,
      stream: bytes,
    });
    return { id, name };
  }

  addPage(content, images) {
    const contentBytes = asciiBytes(content);
    const contentId = this.addObject({
      dictionary: `<< /Length ${contentBytes.length} >>`,
      stream: contentBytes,
    });

    const xObjects = images.length
      ? `/XObject << ${images.map((image) => `/${image.name} ${image.id} 0 R`).join(' ')} >>`
      : '';
    const pageId = this.addObject(
      `<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${this.fonts.F1} 0 R /F2 ${this.fonts.F2} 0 R /F3 ${this.fonts.F3} 0 R >> ${xObjects} >> /Contents ${contentId} 0 R >>`,
    );

    this.pages.push(pageId);
  }

  build() {
    const pagesId = this.addObject(
      `<< /Type /Pages /Kids [${this.pages.map((pageId) => `${pageId} 0 R`).join(' ')}] /Count ${this.pages.length} >>`,
    );
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const chunks = [asciiBytes('%PDF-1.4\n')];
    const offsets = [0];

    this.objects.forEach((object, index) => {
      offsets.push(totalLength(chunks));
      const id = index + 1;
      const header = asciiBytes(`${id} 0 obj\n`);
      const footer = asciiBytes('\nendobj\n');
      chunks.push(header);

      if (typeof object === 'string') {
        chunks.push(asciiBytes(object.replaceAll('PAGES_REF', `${pagesId} 0 R`)));
      } else {
        chunks.push(asciiBytes(`${object.dictionary}\nstream\n`));
        chunks.push(object.stream);
        chunks.push(asciiBytes('\nendstream'));
      }

      chunks.push(footer);
    });

    const xrefOffset = totalLength(chunks);
    chunks.push(asciiBytes(`xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`));
    offsets.slice(1).forEach((offset) => {
      chunks.push(asciiBytes(`${String(offset).padStart(10, '0')} 00000 n \n`));
    });
    chunks.push(
      asciiBytes(
        `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
      ),
    );

    return concatBytes(chunks);
  }
}

function asciiBytes(value) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function concatBytes(chunks) {
  const output = new Uint8Array(totalLength(chunks));
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function totalLength(chunks) {
  return chunks.reduce((sum, chunk) => sum + chunk.length, 0);
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
