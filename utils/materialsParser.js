function parseMaterialLines(input = '') {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart = '', quantityPart = '', unitPart = '', ratePart = ''] = line.split('|');
      const name = namePart.trim();
      const quantity = Number.parseFloat(quantityPart.trim()) || 0;
      const unit = unitPart.trim();
      const rate = Number.parseFloat(ratePart.trim()) || 0;

      return { name, quantity, unit, rate };
    })
    .filter((item) => item.name.length > 0);
}

function materialListToText(materialList = []) {
  return materialList
    .map((item) => `${item.name}|${item.quantity || 0}|${item.unit || ''}|${item.rate || 0}`)
    .join('\n');
}

module.exports = {
  parseMaterialLines,
  materialListToText,
};
