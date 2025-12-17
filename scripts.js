// ===== Single Page App for Employees (CRUD) =====
(function () {
  const onReady = (fn) =>
    document.readyState !== "loading"
      ? fn()
      : document.addEventListener("DOMContentLoaded", fn);

  onReady(() => {
    console.log("DOM ready, binding handlers...");

    // ====== CONFIG ======
    const API_BASE = "https://ooxs5x5f8f.execute-api.ap-south-1.amazonaws.com/employeeapi";

    // ====== HELPERS ======
    function showBadge(id) {
      const el = document.getElementById(id);
      el.classList.remove("d-none");
      setTimeout(() => el.classList.add("d-none"), 1800);
    }

    function clearForm() {
      $("#employeeid").prop("disabled", false);
      $("#employeeid, #name, #department, #salary").val("");
      $("#saveemployee").removeClass("d-none");
      $("#updateemployee").addClass("d-none");
    }

    function validateForm() {
      const employeeid = $("#employeeid").val().trim();
      const name = $("#name").val().trim();
      const department = $("#department").val().trim();
      const salary = $("#salary").val().trim();

      if (!employeeid || !name || !department || !salary) {
        alert("Please fill all required fields.");
        return null;
      }
      if (salary && isNaN(Number(salary))) {
        alert("Salary must be a number.");
        return null;
      }
      return { employeeid, name, department, salary };
    }

    async function apiRequest(path, options = {}) {
      const resp = await fetch(`${API_BASE}${path}`, {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${t}`);
      }
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) return resp.json();
      return resp.text();
    }

    function renderTable(rows) {
      const $tbody = $("#EmployeeTable tbody");
      $tbody.empty();
      if (!rows || rows.length === 0) return;

      rows.forEach((r) => {
        const tr = `
          <tr data-id="${r.employeeid}">
            <td>${r.employeeid}</td>
            <td>${r.name}</td>
            <td>${r.department}</td>
            <td>${r.salary}</td>
            <td class="text-center">
              <button type="button" class="btn btn-sm btn-outline-success me-1 edit-btn" title="Edit">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-btn" title="Delete">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>`;
        $tbody.append(tr);
      });
    }

    async function loadAll(searchTerm = "") {
      try {
        let path = "/employees";
        if (searchTerm) path += `?search=${encodeURIComponent(searchTerm)}`;
        const data = await apiRequest(path);
        renderTable(Array.isArray(data) ? data : []);
      } catch (e) {
        alert("Error retrieving employees: " + e.message);
      }
    }

    // ====== EVENTS ======

    // Create
    document.getElementById("saveemployee").onclick = async function () {
      console.log("Save clicked");
      const payload = validateForm();
      if (!payload) return;

      try {
        await apiRequest("/employees", { method: "POST", body: payload });
        showBadge("EmployeeSaved");
        await loadAll(); // refresh table
        clearForm();
      } catch (e) {
        alert("Error saving employee: " + e.message);
      }
    };

    // Update
    document.getElementById("updateemployee").onclick = async function () {
      console.log("Update clicked");
      const payload = validateForm();
      if (!payload) return;

      try {
        await apiRequest(`/employees/${encodeURIComponent(payload.employeeid)}`, {
          method: "PUT",
          body: { name: payload.name, department: payload.department, salary: payload.salary },
        });
        showBadge("EmployeeUpdated");
        await loadAll();
        clearForm();
      } catch (e) {
        alert("Error updating employee: " + e.message);
      }
    };

    // Reset
    document.getElementById("resetform").onclick = function () {
      clearForm();
    };

    // View All
    document.getElementById("getemployees").onclick = async function () {
      console.log("View All clicked");
      await loadAll();
    };

    // Search
    document.getElementById("searchBtn").onclick = async function () {
      const q = ($("#searchBox").val() || "").trim();
      await loadAll(q);
    };

    // Edit/Delete delegation
    $(document).on("click", ".edit-btn", function () {
      const $tr = $(this).closest("tr");
      const id = $tr.data("id");
      const tds = $tr.find("td");
      const name = $(tds[1]).text();
      const department = $(tds[2]).text();
      const salary = $(tds[3]).text();

      $("#employeeid").val(id).prop("disabled", true);
      $("#name").val(name);
      $("#department").val(department);
      $("#salary").val(salary);

      $("#saveemployee").addClass("d-none");
      $("#updateemployee").removeClass("d-none");
    });

    $(document).on("click", ".delete-btn", async function () {
      const $tr = $(this).closest("tr");
      const id = $tr.data("id");
      if (!confirm(`Delete employee ${id}?`)) return;

      try {
        await apiRequest(`/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadAll();
      } catch (e) {
        alert("Error deleting employee: " + e.message);
      }
    });

    // Optional: auto-load table on page open
    // loadAll();
  });
})();


