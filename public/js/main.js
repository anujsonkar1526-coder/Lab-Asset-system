/**
 * LabTrackOS - Interactive Frontend Utilities & Micro-Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Navigation Menu Toggle
  const mobileNavToggle = document.getElementById('mobileNavToggle');
  const navLinks = document.getElementById('navLinks');
  if (mobileNavToggle && navLinks) {
    mobileNavToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // 2. Auto-dismiss Flash Alerts
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach((alert) => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-10px)';
      setTimeout(() => alert.remove(), 500);
    }, 6000);
  });

  // 3. Real-time Live Table Search
  const searchInputs = document.querySelectorAll('.table-search-input');
  searchInputs.forEach((input) => {
    input.addEventListener('input', function () {
      const query = this.value.toLowerCase().trim();
      const targetTableId = this.getAttribute('data-table-target');
      const table = targetTableId ? document.getElementById(targetTableId) : this.closest('.table-card')?.querySelector('table');
      
      if (!table) return;

      const rows = table.querySelectorAll('tbody tr');
      let visibleCount = 0;

      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        if (text.includes(query)) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });

      // Update count badge if present
      const countBadge = this.closest('.table-card')?.querySelector('.table-count-badge');
      if (countBadge && query !== '') {
        countBadge.textContent = `${visibleCount} found`;
      }
    });
  });

  // 4. Export Table to CSV
  window.exportTableToCSV = function (tableId, filename = 'export.csv') {
    const table = document.getElementById(tableId);
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach((row) => {
      // Don't include rows hidden by search filter
      if (row.style.display === 'none') return;

      const cols = row.querySelectorAll('th, td');
      let rowData = [];

      cols.forEach((col) => {
        // Exclude action buttons column from CSV
        if (col.classList.contains('text-right') || col.querySelector('button, .action-btn-group, form')) {
          return;
        }
        let cleanText = col.innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""').trim();
        rowData.push(`"${cleanText}"`);
      });

      if (rowData.length > 0) {
        csv.push(rowData.join(','));
      }
    });

    const csvFile = new Blob([csv.join('\n')], { type: 'text/csv' });
    const downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // 5. Quick Demo Credentials Autofill Helper
  window.fillDemoCredentials = function (role) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!emailInput || !passwordInput) return;

    if (role === 'admin') {
      emailInput.value = 'admin.test@college.edu';
      passwordInput.value = 'password123';
    } else if (role === 'incharge') {
      emailInput.value = 'incharge.test@college.edu';
      passwordInput.value = 'password123';
    } else if (role === 'student' || role === 'requester') {
      emailInput.value = 'student.test@college.edu';
      passwordInput.value = 'password123';
    }

    // Subtle feedback animation on inputs
    [emailInput, passwordInput].forEach((input) => {
      input.style.backgroundColor = 'var(--primary-light)';
      setTimeout(() => {
        input.style.transition = 'background-color 0.4s ease';
        input.style.backgroundColor = 'var(--bg-surface)';
      }, 300);
    });
  };

  // 6. Copy to Clipboard Tooltip Helper
  window.copyToClipboard = function (text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
      if (!btnElement) return;
      const originalHtml = btnElement.innerHTML;
      btnElement.innerHTML = '✓ Copied';
      btnElement.style.color = 'var(--success-dark)';
      setTimeout(() => {
        btnElement.innerHTML = originalHtml;
        btnElement.style.color = '';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  };
});
