(function initTempPhotoGallery() {
  const input = document.getElementById('photos-input');
  const gallery = document.getElementById('photo-preview-gallery');

  if (!input || !gallery) {
    return;
  }

  function toDateTimeInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function clearGallery() {
    for (const image of gallery.querySelectorAll('img')) {
      if (image.dataset.objectUrl) {
        URL.revokeObjectURL(image.dataset.objectUrl);
      }
    }

    gallery.innerHTML = '';
  }

  function renderPreviews(files) {
    clearGallery();

    if (!files.length) {
      return;
    }

    files.forEach((file, index) => {
      const card = document.createElement('article');
      card.className = 'photo-preview-card';

      const image = document.createElement('img');
      const objectUrl = URL.createObjectURL(file);
      image.src = objectUrl;
      image.dataset.objectUrl = objectUrl;
      image.alt = file.name;

      const title = document.createElement('p');
      title.className = 'photo-preview-name';
      title.textContent = file.name;

      const label = document.createElement('label');
      label.textContent = 'Photo Note';

      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.name = 'photoNotes';
      noteInput.maxLength = 280;
      noteInput.placeholder = 'Add a note for this photo';

      const dateLabel = document.createElement('label');
      dateLabel.textContent = 'Photo Date and Time';

      const dateInput = document.createElement('input');
      dateInput.type = 'datetime-local';
      dateInput.name = 'photoDates';
      dateInput.value = toDateTimeInputValue(new Date());

      label.appendChild(noteInput);
      dateLabel.appendChild(dateInput);
      card.appendChild(image);
      card.appendChild(title);
      card.appendChild(label);
      card.appendChild(dateLabel);
      gallery.appendChild(card);
    });
  }

  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    renderPreviews(files);
  });
})();
