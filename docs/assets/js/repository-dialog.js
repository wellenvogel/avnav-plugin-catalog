document.querySelectorAll(".repository-dialog-open").forEach((link) => {
  link.addEventListener("click", (event) => {
    const dialog = document.getElementById(link.getAttribute("aria-controls"));
    if (!dialog) {
      console.error(`Repository dialog not found: ${link.getAttribute("aria-controls")}`);
      return;
    }
    event.preventDefault();
    dialog.showModal();
  });
});
