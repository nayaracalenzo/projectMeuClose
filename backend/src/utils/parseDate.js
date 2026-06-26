function parseDate(dateString) {
  if (!dateString) return null;

  const [datePart, timePart] = dateString.split(' ');
  const [month, day, year] = datePart.split('/');

  const [hours, minutes, seconds] = timePart.split(':');

  const date = new Date(
    Number(year),
    Number(month) - 1, // mês começa em 0
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds)
  );

  return isNaN(date.getTime()) ? null : date;
}

module.exports = parseDate