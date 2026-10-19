// NOLFLIX interactions

const signInBtn = document.getElementById("signInBtn");
const signInModal = document.getElementById("signInModal");
const closeModal = document.getElementById("closeModal");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

signInBtn.addEventListener("click", () => {
    signInModal.classList.add("show");
});

closeModal.addEventListener("click", () => {
    signInModal.classList.remove("show");
});

signInModal.addEventListener("click", (event) => {
    if (event.target === signInModal) {
        signInModal.classList.remove("show");
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        signInModal.classList.remove("show");
    }
});

loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginMessage.textContent = "Demo sign-in submitted.";
});

document.querySelectorAll(".faq-question").forEach((button) => {
    button.addEventListener("click", () => {
        const current = button.parentElement;
        const wasOpen = current.classList.contains("open");

        document.querySelectorAll(".faq").forEach((item) => {
            item.classList.remove("open");
        });

        if (!wasOpen) {
            current.classList.add("open");
        }
    });
});

function handleEmailForm(formId, messageId) {
    const form = document.getElementById(formId);
    const message = document.getElementById(messageId);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const email = form.querySelector("input").value.trim();

        if (!email) return;

        message.textContent = `Thanks! ${email} has been entered for NOLFLIX.`;
        form.querySelector("input").value = "";
    });
}

handleEmailForm("heroForm", "heroMessage");
handleEmailForm("bottomForm", "bottomMessage");
