(function initCalendarDnD() {
  const events = document.querySelectorAll('.calendar-event');
  const dropzones = document.querySelectorAll('.calendar-dropzone');

  if (!events.length || !dropzones.length) {
    return;
  }

  events.forEach((eventCard) => {
    eventCard.addEventListener('dragstart', (event) => {
      eventCard.dataset.dragging = '1';
      const payload = {
        jobId: eventCard.dataset.jobId,
        workDayId: eventCard.dataset.workdayId,
      };
      event.dataTransfer.setData('application/json', JSON.stringify(payload));
      event.dataTransfer.effectAllowed = 'move';
    });

    eventCard.addEventListener('dragend', () => {
      setTimeout(() => {
        eventCard.dataset.dragging = '0';
      }, 0);
    });

    eventCard.addEventListener('click', () => {
      if (eventCard.dataset.dragging === '1') {
        return;
      }

      const jobId = eventCard.dataset.jobId;
      if (!jobId) {
        return;
      }

      window.location.href = `/jobs/${jobId}`;
    });
  });

  dropzones.forEach((zone) => {
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', async (event) => {
      event.preventDefault();
      zone.classList.remove('drag-over');

      const raw = event.dataTransfer.getData('application/json');
      if (!raw) {
        return;
      }

      const payload = JSON.parse(raw);
      if (!payload.jobId || !payload.workDayId) {
        return;
      }

      const nextDate = zone.dataset.date;
      const response = await fetch(`/jobs/${payload.jobId}/workdays/${payload.workDayId}/reschedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: nextDate }),
      });

      if (response.ok) {
        window.location.reload();
      }
    });
  });
})();
