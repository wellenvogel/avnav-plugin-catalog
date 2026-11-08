document.querySelectorAll("time.plugin-last-updated").forEach((element) => {
  const date = new Date(element.dateTime);
  if (Number.isNaN(date.getTime())) {
    console.error(`Invalid plugin update timestamp: ${element.dateTime}`);
    return;
  }

  element.textContent = date.toLocaleString(document.documentElement.lang || undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
});
