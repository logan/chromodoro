var chromodoro = chrome.extension.getBackgroundPage();

// Widget for the user to enter task titles. Also updates the status message
// on state changes.
function TaskInput(container, input, canvas, status_msg) {
  this.container = container;
  this.input = input;
  this.canvas = canvas;
  this.status_msg = status_msg;
  this.previous_value = chromodoro.getLastTaskTitle();
  this.changed = false;

  var self = this;
  this.container.onsubmit = function() { self.onSubmit(); };
}

// Updates the status and transitions us into the WORKING state when the user
// submits the form. Swaps the form out and restores the progress bar.
TaskInput.prototype.onSubmit = function() {
  var value = this.input.value;
  this.previous_value = value;
  this.updateWorkingStatus();
  chromodoro.startWorking(value);
  this.scheduleAutoClose();
};

// Set the status when work enters progress.
TaskInput.prototype.updateWorkingStatus = function() {
  this.container.style["display"] = "none";
  this.canvas.style["display"] = "block";
  if (this.previous_value && this.previous_value.length > 0) {
    this.status_msg.innerHTML = "Working on ";
    var b = document.createElement("b");
    b.appendChild(document.createTextNode(this.previous_value));
    this.status_msg.appendChild(b);
    this.status_msg.appendChild(document.createTextNode("."));
  } else {
    this.status_msg.innerHTML = "Working.";
  }
};

// Restores the task form in place of the progress bar when we enter the IDLING
// state.
TaskInput.prototype.restore = function() {
  this.status_msg.innerHTML = "What do you want to work on now?";
  this.canvas.style["display"] = "none";
  this.container.style["display"] = "block";
  if (this.previous_value == null) {
    this.input.value = "stuff";
  } else {
    this.input.value = this.previous_value;
  }
  this.input.focus();
  this.input.select();
};

TaskInput.prototype.scheduleAutoClose = function() {
  this.cancelAutoClose();
  this.auto_close_timeout = setTimeout(window.close, 1200);
};

TaskInput.prototype.cancelAutoClose = function() {
  if (this.auto_close_timeout) {
    clearTimeout(this.auto_close_timeout);
    this.auto_close_timeout = null;
  }
};


function installInterface(opt_interactive) {
  var interactive = opt_interactive == null || opt_interactive;

  var interface = document.getElementById("interface");

  var countdown = document.createElement("div");
  countdown.setAttribute("id", "countdown");
  interface.appendChild(countdown);

  var canvas = document.createElement("canvas");
  var width = window.innerWidth - 88;
  canvas.setAttribute("id", "canvas");
  canvas.setAttribute("width", width);
  canvas.setAttribute("height", 24);
  interface.appendChild(canvas);

  if (interactive) {
    var task_container = document.createElement("form");
    task_container.setAttribute("id", "task_container");
    var table = document.createElement("table");
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.setAttribute("id", "task_input_cell");
    var task = document.createElement("input");
    task.setAttribute("id", "task");
    td.appendChild(task);
    tr.appendChild(td);
    td = document.createElement("td");
    var submit = document.createElement("input");
    submit.setAttribute("type", "submit");
    submit.setAttribute("value", "Start");
    td.appendChild(submit);
    tr.appendChild(td);
    table.appendChild(tr);
    task_container.appendChild(table);
    interface.appendChild(task_container);

    var status_msg = document.createElement("div");
    status_msg.setAttribute("id", "status");
    status_msg.innerHTML = "What do you want to work on now?";
    interface.appendChild(status_msg);

    var task_input = new TaskInput(task_container, task, canvas, status_msg);
    window.addEventListener(
        "click", function(e) { task_input.cancelAutoClose(); }, true);
  } else if (chromodoro.state == chromodoro.IDLING) {
    interface.parentNode.style["padding-top"] = 0;
    interface.style.display = "none";
  }

  var progress_bar = new chromodoro.ProgressBar(canvas, false, interactive);
  var prev_state = chromodoro.state;

  // Callback for background.html to invoke on each timer tick or state change.
  function observe(percentage, color, label) {
    if (!window || window.closed) {
      return false;
    }
    countdown.innerHTML = chromodoro.formatTimeRemaining();
    if (chromodoro.state == chromodoro.IDLING) {
      if (task_input) {
        task_input.restore();
      }
      if (!interactive && prev_state == chromodoro.RESTING) {
        // This means we're in a notification window brought up by the end of
        // a work period. Since a new notification is about to appear, close
        // this one.
        window.close();
        return false;
      }
      if (prev_state == chromodoro.WORKING) {
        if (interactive) {
          status_msg.innerHTML = "Interrupted! What now?";
        }
      }
    } else {
      if (chromodoro.state == chromodoro.WORKING
          && prev_state != chromodoro.WORKING) {
        if (task_input) {
          task_input.updateWorkingStatus();
        }
      }
      if (chromodoro.state == chromodoro.RESTING) {
        if (interactive) {
          status_msg.innerHTML = "Time for a break!";
        }
      }
      progress_bar.update(percentage, color, label);
    }
    prev_state = chromodoro.state;
    return true;
  }
  chromodoro.registerObserver(observe);
  chromodoro.updateProgress();
}
