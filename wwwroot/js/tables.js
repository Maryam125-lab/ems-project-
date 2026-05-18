/* ═══════════════════════════════════════════
   TRACK360 ERP - Table Sorting, Filtering & Pagination
   ═══════════════════════════════════════════ */

// ─── TABLE SORTING ───
function sortTable(tableId, colIndex) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var tbody = table.querySelector('tbody');
    var rows = Array.from(tbody.querySelectorAll('tr'));
    var headers = table.querySelectorAll('th');
    var header = headers[colIndex];

    // Determine sort direction
    var ascending = !header.classList.contains('sorted-asc');

    // Reset all headers
    headers.forEach(function (h) {
        h.classList.remove('sorted', 'sorted-asc', 'sorted-desc');
        var icon = h.querySelector('.sort-icon');
        if (icon) icon.textContent = '↕';
    });

    // Set current header
    header.classList.add('sorted', ascending ? 'sorted-asc' : 'sorted-desc');
    var sortIcon = header.querySelector('.sort-icon');
    if (sortIcon) sortIcon.textContent = ascending ? '↑' : '↓';

    // Sort rows
    rows.sort(function (a, b) {
        var aVal = a.cells[colIndex].textContent.trim().toLowerCase();
        var bVal = b.cells[colIndex].textContent.trim().toLowerCase();

        // Try numeric sort
        var aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ''));
        var bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ''));

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return ascending ? aNum - bNum : bNum - aNum;
        }

        // String sort
        if (ascending) {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });

    // Re-append sorted rows
    rows.forEach(function (row) {
        tbody.appendChild(row);
    });
}

// ─── TABLE SEARCH/FILTER ───
function filterTable(tableId, searchInputId) {
    var input = document.getElementById(searchInputId);
    var table = document.getElementById(tableId);
    if (!input || !table) return;

    var filter = input.value.toLowerCase();
    var rows = table.querySelectorAll('tbody tr');
    var visibleCount = 0;

    rows.forEach(function (row) {
        var text = row.textContent.toLowerCase();
        if (text.indexOf(filter) > -1) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Update count display if exists
    var countEl = document.getElementById(tableId + '-count');
    if (countEl) {
        countEl.textContent = visibleCount;
    }
}

// ─── DROPDOWN FILTER ───
function filterTableByColumn(tableId, colIndex, value) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var rows = table.querySelectorAll('tbody tr');

    rows.forEach(function (row) {
        if (!value || value === 'all') {
            row.style.display = '';
        } else {
            var cellText = row.cells[colIndex].textContent.trim().toLowerCase();
            if (cellText.indexOf(value.toLowerCase()) > -1) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

// ─── PAGINATION ───
function initPagination(tableId, rowsPerPage) {
    rowsPerPage = rowsPerPage || 10;
    var table = document.getElementById(tableId);
    if (!table) return;

    var tbody = table.querySelector('tbody');
    var rows = Array.from(tbody.querySelectorAll('tr'));
    var totalPages = Math.ceil(rows.length / rowsPerPage);
    var currentPage = 1;

    function showPage(page) {
        currentPage = page;
        var start = (page - 1) * rowsPerPage;
        var end = start + rowsPerPage;

        rows.forEach(function (row, index) {
            row.style.display = (index >= start && index < end) ? '' : 'none';
        });

        updatePaginationUI();
    }

    function updatePaginationUI() {
        var container = document.getElementById(tableId + '-pagination');
        if (!container) return;

        var start = (currentPage - 1) * rowsPerPage + 1;
        var end = Math.min(currentPage * rowsPerPage, rows.length);

        var infoEl = container.querySelector('.pagination-info');
        if (infoEl) {
            infoEl.innerHTML = 'Showing <strong>' + start + '</strong> to <strong>' + end + '</strong> of <strong>' + rows.length + '</strong>';
        }

        var controls = container.querySelector('.pagination-controls');
        if (!controls) return;

        var html = '';
        html += '<button class="page-btn ' + (currentPage === 1 ? 'disabled' : '') + '" onclick="goToPage(\'' + tableId + '\',' + (currentPage - 1) + ',' + rowsPerPage + ')">';
        html += '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>';
        html += '</button>';

        for (var i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                html += '<button class="page-btn active">' + i + '</button>';
            } else if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                html += '<button class="page-btn" onclick="goToPage(\'' + tableId + '\',' + i + ',' + rowsPerPage + ')">' + i + '</button>';
            } else if (Math.abs(i - currentPage) === 2) {
                html += '<span style="color:var(--muted);padding:0 4px;">…</span>';
            }
        }

        html += '<button class="page-btn ' + (currentPage === totalPages ? 'disabled' : '') + '" onclick="goToPage(\'' + tableId + '\',' + (currentPage + 1) + ',' + rowsPerPage + ')">';
        html += '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';
        html += '</button>';

        controls.innerHTML = html;
    }

    showPage(1);
}

function goToPage(tableId, page, rowsPerPage) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var rows = Array.from(table.querySelectorAll('tbody tr'));
    var totalPages = Math.ceil(rows.length / rowsPerPage);

    if (page < 1 || page > totalPages) return;

    var start = (page - 1) * rowsPerPage;
    var end = start + rowsPerPage;

    rows.forEach(function (row, index) {
        row.style.display = (index >= start && index < end) ? '' : 'none';
    });

    // Update page info & controls
    var container = document.getElementById(tableId + '-pagination');
    if (container) {
        var infoEl = container.querySelector('.pagination-info');
        if (infoEl) {
            var showEnd = Math.min(end, rows.length);
            infoEl.innerHTML = 'Showing <strong>' + (start + 1) + '</strong> to <strong>' + showEnd + '</strong> of <strong>' + rows.length + '</strong>';
        }

        // Re-render controls
        var controls = container.querySelector('.pagination-controls');
        if (controls) {
            var html = '';
            html += '<button class="page-btn ' + (page === 1 ? 'disabled' : '') + '" onclick="goToPage(\'' + tableId + '\',' + (page - 1) + ',' + rowsPerPage + ')">';
            html += '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>';
            html += '</button>';

            for (var i = 1; i <= totalPages; i++) {
                if (i === page) {
                    html += '<button class="page-btn active">' + i + '</button>';
                } else if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
                    html += '<button class="page-btn" onclick="goToPage(\'' + tableId + '\',' + i + ',' + rowsPerPage + ')">' + i + '</button>';
                } else if (Math.abs(i - page) === 2) {
                    html += '<span style="color:var(--muted);padding:0 4px;">…</span>';
                }
            }

            html += '<button class="page-btn ' + (page === totalPages ? 'disabled' : '') + '" onclick="goToPage(\'' + tableId + '\',' + (page + 1) + ',' + rowsPerPage + ')">';
            html += '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';
            html += '</button>';

            controls.innerHTML = html;
        }
    }
}

// ─── SELECT ALL ROWS ───
function toggleSelectAll(tableId, checkbox) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var checkboxes = table.querySelectorAll('tbody .table-checkbox');
    checkboxes.forEach(function (cb) {
        cb.checked = checkbox.checked;
        var row = cb.closest('tr');
        if (row) {
            row.classList.toggle('selected', checkbox.checked);
        }
    });
}

function toggleRowSelect(checkbox) {
    var row = checkbox.closest('tr');
    if (row) {
        row.classList.toggle('selected', checkbox.checked);
    }
}
