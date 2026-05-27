(function initJobFormEnhancements() {
  const workDayRows = document.getElementById('work-day-rows');
  const addWorkDayButton = document.getElementById('add-work-day');
  const checklistRows = document.getElementById('checklist-rows');
  const addChecklistButton = document.getElementById('add-checklist-row');
  const applyChecklistButton = document.getElementById('apply-checklist-template');
  const checklistTemplatePicker = document.getElementById('checklist-template-picker');
  const materialTemplatePicker = document.getElementById('material-template-picker');
  const addMaterialUsedButton = document.getElementById('add-material-used');
  const addMaterialLeftButton = document.getElementById('add-material-left');
  const materialsUsedInput = document.getElementById('materials-used-input');
  const materialsLeftInput = document.getElementById('materials-left-input');
  const signatureCanvas = document.getElementById('signature-canvas');
  const signatureDataInput = document.getElementById('signoff-data-url');
  const clearSignatureInput = document.getElementById('clear-signature');
  const clearSignatureButton = document.getElementById('clear-signature-button');
  const canEditFinancials = window.jobFormCanEditFinancials !== false;
  const financialReadOnlyAttribute = canEditFinancials ? '' : 'readonly';

  function createWorkDayRow() {
    const row = document.createElement('div');
    row.className = 'work-day-row';
    row.innerHTML = `
      <input type="hidden" name="workDayId" value="" />

      <label>
        Date and Time
        <input type="datetime-local" name="workDayDate" />
      </label>

      <label>
        Hours
        <input type="number" min="0" max="24" step="0.25" name="workDayHours" />
      </label>

      <label class="currency-label">
        Labour Cost
        <input type="number" min="0" step="0.01" name="workDayLaborCost" ${financialReadOnlyAttribute} />
      </label>

      <label class="currency-label">
        Material Cost
        <input type="number" min="0" step="0.01" name="workDayMaterialCost" ${financialReadOnlyAttribute} />
      </label>

      <label class="work-day-note">
        Note
        <input type="text" name="workDayNote" placeholder="Day summary or notes" />
      </label>

      <button class="button button-danger remove-work-day" type="button">Remove</button>
    `;

    attachWorkDayRemove(row);
    return row;
  }

  function attachWorkDayRemove(row) {
    const removeButton = row.querySelector('.remove-work-day');
    if (!removeButton) {
      return;
    }

    removeButton.addEventListener('click', () => {
      if (workDayRows.children.length <= 1) {
        row.querySelectorAll('input').forEach((input) => {
          if (input.type !== 'hidden') {
            input.value = '';
          }
        });
        row.querySelector('input[name="workDayId"]').value = '';
        return;
      }

      row.remove();
    });
  }

  function createChecklistRow(label = '', completed = false) {
    const row = document.createElement('div');
    row.className = 'checklist-row';
    row.innerHTML = `
      <label class="checklist-label">
        Item
        <input type="text" name="checklistLabel" value="${label}" />
      </label>

      <div class="checklist-row-actions">
        <label class="checklist-toggle">
          <input class="checklist-complete-toggle" type="checkbox" ${completed ? 'checked' : ''} />
          <span><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Done</span>
        </label>
        <input type="hidden" name="checklistState" value="${completed ? '1' : '0'}" />

        <button class="button button-danger icon-button remove-checklist-row" type="button" aria-label="Remove checklist item" title="Remove checklist item"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
      </div>
    `;

    attachChecklistStateToggle(row);
    attachChecklistRemove(row);
    return row;
  }

  function attachChecklistStateToggle(row) {
    const toggle = row.querySelector('.checklist-complete-toggle');
    const stateInput = row.querySelector('input[name="checklistState"]');
    if (!toggle || !stateInput) {
      return;
    }

    toggle.addEventListener('change', () => {
      stateInput.value = toggle.checked ? '1' : '0';
    });
  }

  function attachChecklistRemove(row) {
    const removeButton = row.querySelector('.remove-checklist-row');
    if (!removeButton) {
      return;
    }

    removeButton.addEventListener('click', () => {
      if (checklistRows.children.length <= 1) {
        row.querySelector('input[name="checklistLabel"]').value = '';
        row.querySelector('input[name="checklistState"]').value = '0';
        const toggle = row.querySelector('.checklist-complete-toggle');
        if (toggle) {
          toggle.checked = false;
        }
        return;
      }

      row.remove();
    });
  }

  function appendMaterialLine(target, line) {
    if (!target || !line) {
      return;
    }

    target.value = target.value.trim() ? `${target.value.trim()}\n${line}` : line;
  }

  if (workDayRows && addWorkDayButton) {
    Array.from(workDayRows.children).forEach(attachWorkDayRemove);
    addWorkDayButton.addEventListener('click', () => {
      workDayRows.appendChild(createWorkDayRow());
    });
  }

  if (checklistRows) {
    Array.from(checklistRows.children).forEach((row) => {
      attachChecklistStateToggle(row);
      attachChecklistRemove(row);
    });
  }

  if (checklistRows && addChecklistButton) {
    addChecklistButton.addEventListener('click', () => {
      checklistRows.appendChild(createChecklistRow());
    });
  }

  if (checklistRows && applyChecklistButton && checklistTemplatePicker) {
    applyChecklistButton.addEventListener('click', () => {
      const templateName = checklistTemplatePicker.value;
      if (!templateName || !Array.isArray(window.checklistTemplateData)) {
        return;
      }

      const selectedTemplate = window.checklistTemplateData.find((template) => template.name === templateName);
      if (!selectedTemplate) {
        return;
      }

      checklistRows.innerHTML = '';
      (selectedTemplate.items || []).forEach((item) => {
        checklistRows.appendChild(createChecklistRow(item, false));
      });

      if (!checklistRows.children.length) {
        checklistRows.appendChild(createChecklistRow());
      }
    });
  }

  if (materialTemplatePicker && addMaterialUsedButton && addMaterialLeftButton) {
    addMaterialUsedButton.addEventListener('click', () => {
      appendMaterialLine(materialsUsedInput, materialTemplatePicker.value);
    });

    addMaterialLeftButton.addEventListener('click', () => {
      appendMaterialLine(materialsLeftInput, materialTemplatePicker.value);
    });
  }

  if (signatureCanvas && signatureDataInput && clearSignatureInput && clearSignatureButton) {
    const ctx = signatureCanvas.getContext('2d');
    let drawing = false;

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';

    function getPoint(event) {
      const rect = signatureCanvas.getBoundingClientRect();
      const source = event.touches ? event.touches[0] : event;
      return {
        x: source.clientX - rect.left,
        y: source.clientY - rect.top,
      };
    }

    function startDraw(event) {
      drawing = true;
      const point = getPoint(event);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      event.preventDefault();
    }

    function draw(event) {
      if (!drawing) {
        return;
      }

      const point = getPoint(event);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      signatureDataInput.value = signatureCanvas.toDataURL('image/png');
      clearSignatureInput.value = '0';
      event.preventDefault();
    }

    function endDraw() {
      drawing = false;
    }

    signatureCanvas.addEventListener('mousedown', startDraw);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', endDraw);
    signatureCanvas.addEventListener('mouseleave', endDraw);

    signatureCanvas.addEventListener('touchstart', startDraw, { passive: false });
    signatureCanvas.addEventListener('touchmove', draw, { passive: false });
    signatureCanvas.addEventListener('touchend', endDraw);

    if (signatureDataInput.value) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, signatureCanvas.width, signatureCanvas.height);
      };
      image.src = signatureDataInput.value;
    }

    clearSignatureButton.addEventListener('click', () => {
      ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
      signatureDataInput.value = '';
      clearSignatureInput.value = '1';
    });
  }
})();
