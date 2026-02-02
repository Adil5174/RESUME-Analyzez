async function submitData() {
  const jobDesc = document.getElementById("jobDesc").value;
  const files = document.getElementById("resumes").files;

  if (!jobDesc || files.length === 0) {
    alert("Please enter job description and upload resumes");
    return;
  }

  const formData = new FormData();
  formData.append("jobDescription", jobDesc);
  for (let file of files) formData.append("resumes", file);

  // Show loader
  document.getElementById("loader").style.display = "block";
  document.getElementById("results").innerHTML = "";
  document.getElementById("downloadPDF").style.display = "none";

  try {
    const response = await fetch("/screen", { method: "POST", body: formData });
    const data = await response.json();
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "<h3 style='color:#00f0ff;'>Results</h3>";

    data.forEach((r, i) => {
      // Candidate card
      const card = document.createElement("div");
      card.className = "candidate-card";

      card.innerHTML = `
        <div class="card-header">
          <b>${i + 1}. ${r.file_name}</b><br>
          Name: ${r.name || "-"}<br>
          Email: ${r.email || "-"}<br>
          Match Score: ${r.match_score}%<br>
          Summary: ${r.summary || "-"}<br>
        </div>
        <div class="card-body">
          <div class="skills-badges">
            <div><strong>Matching Skills:</strong> ${r.matching_skills.length ? r.matching_skills.map(skill => `<span class='skill-badge matching'>${skill}</span>`).join(' ') : "-"}</div>
            <div><strong>Missing Skills:</strong> ${r.missing_skills.length ? r.missing_skills.map(skill => `<span class='skill-badge missing'>${skill}</span>`).join(' ') : "-"}</div>
          </div>
          <canvas id="chart-${i}" width="200" height="150"></canvas>
        </div>
      `;

      resultsDiv.appendChild(card);

      // Chart.js doughnut chart
      const ctx = document.getElementById(`chart-${i}`).getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Matching Skills', 'Missing Skills'],
          datasets: [{
            data: [r.matching_skills.length, r.missing_skills.length],
            backgroundColor: ['#00f0ff', '#ff00e0'],
            hoverOffset: 10,
            borderWidth: 2,
            borderColor: '#1b1b27'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#e0e0e0', font: { size: 12 } }
            },
            tooltip: {
              enabled: true,
              backgroundColor: '#12121b',
              titleColor: '#00f0ff',
              bodyColor: '#e0e0e0'
            }
          }
        }
      });
    });

    document.getElementById("downloadPDF").style.display = "inline-block";

  } catch (err) {
    console.error("Error:", err);
    alert("Server error. Check console.");
  } finally {
    document.getElementById("loader").style.display = "none";
  }
}
