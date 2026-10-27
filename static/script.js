const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#task-title");
const priorityInput = document.querySelector("#task-priority");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const message = document.querySelector("#message");
const saveButton = taskForm.querySelector("button[type='submit']");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function renderTasks(tasks) {
  taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  if (!tasks.length) {
    taskList.innerHTML = '<tr><td colspan="6" class="empty-cell">No tasks yet. Add your first task above.</td></tr>';
    return;
  }

  taskList.innerHTML = tasks.map((task, index) => {
    const priorityClass = `priority-${task.priority.toLowerCase()}`;
    const completed = task.status === "Completed";
    return `
      <tr>
        <td>${index + 1}</td>
        <td class="task-title-cell ${completed ? "completed" : ""}">${escapeHtml(task.title)}</td>
        <td>${escapeHtml(task.created_at || "")}</td>
        <td><span class="priority-badge ${priorityClass}">${escapeHtml(task.priority)}</span></td>
        <td><span class="status-text ${completed ? "status-completed" : "status-pending"}">${escapeHtml(task.status)}</span></td>
        <td>
          <div class="action-buttons">
            <button class="icon-button" type="button" title="${completed ? "Mark pending" : "Mark completed"}"
              aria-label="${completed ? "Mark pending" : "Mark completed"}" data-action="toggle" data-id="${task.id}">
              ${completed ? "↶" : "✓"}
            </button>
            <button class="icon-button delete" type="button" title="Delete task" aria-label="Delete task"
              data-action="delete" data-id="${task.id}">▤</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

async function loadTasks() {
  try {
    const tasks = await api("/api/tasks");
    renderTasks(tasks);
  } catch (error) {
    taskList.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
    showMessage("Check that Flask is running and the MySQL connection settings are correct.", "error");
  }
}

taskForm.addEventListener("submit", async event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    showMessage("Please enter a task name.", "error");
    titleInput.focus();
    return;
  }

  saveButton.disabled = true;
  showMessage("");
  try {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title, priority: priorityInput.value })
    });
    titleInput.value = "";
    priorityInput.value = "Medium";
    showMessage("Task saved successfully.", "success");
    await loadTasks();
    titleInput.focus();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    saveButton.disabled = false;
  }
});

taskList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  button.disabled = true;

  try {
    if (button.dataset.action === "toggle") {
      const row = button.closest("tr");
      const currentStatus = row.querySelector(".status-text").textContent;
      const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
      await api(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      showMessage(`Task marked ${nextStatus.toLowerCase()}.`, "success");
    } else if (button.dataset.action === "delete") {
      if (!window.confirm("Delete this task?")) {
        button.disabled = false;
        return;
      }
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      showMessage("Task deleted.", "success");
    }
    await loadTasks();
  } catch (error) {
    showMessage(error.message, "error");
    button.disabled = false;
  }
});

document.querySelectorAll(".menu-item").forEach(button => {
  button.addEventListener("click", () => {
    const menu = button.dataset.menu;
    const messages = {
      File: "Use the task form to add a new task.",
      Edit: "Select a task action to update or delete it.",
      View: "The task list shows all saved tasks.",
      Window: "This web version runs in your browser.",
      Help: "Add a task, choose its priority, and click SAVE."
    };
    showMessage(messages[menu] || "", "");
  });
});

loadTasks();
