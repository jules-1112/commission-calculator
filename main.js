// Merged JavaScript from index.html and script.js

// Navigation and login logic
// All DOM wiring is performed after the DOM is ready to avoid missing elements.
document.addEventListener('DOMContentLoaded', function () {
  const loginSection = document.getElementById('login-section');
  const calculatorSection = document.getElementById('calculator-section');

  const logoutBtn = document.getElementById('logout-btn');

  const form = document.getElementById('login-form');
  const toggle = document.querySelector('.toggle-visibility');
  const password = document.getElementById('password');
  const email = document.getElementById('email');
  const remember = document.getElementById('remember');
  const error = document.getElementById('login-error');

  function showSection(section) {
    [loginSection, calculatorSection].forEach((s) => s.classList.add('hidden'));
    section.classList.remove('hidden');
  }

  function setLoginError(isVisible) {
    if (!error) return;
    error.hidden = !isVisible;
  }

  logoutBtn?.addEventListener('click', () => showSection(loginSection));

  // Toggle password visibility for login
  if (toggle && password) {
    toggle.addEventListener('click', () => {
      const isHidden = password.type === 'password';
      password.type = isHidden ? 'text' : 'password';
      toggle.textContent = isHidden ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  }

  // Login form submission
  if (form && email && password && error) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const emailValue = email.value.trim();
      const passwordValue = password.value.trim();
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
      const isValidPassword = passwordValue.length >= 4;

      if (!isValidEmail || !isValidPassword) {
        setLoginError(true);
        return;
      }

      setLoginError(false);

      if (remember && remember.checked) {
        localStorage.setItem('fr_saved_email', emailValue);
      } else {
        localStorage.removeItem('fr_saved_email');
      }

      showSection(calculatorSection);
    });

    const savedEmail = localStorage.getItem('fr_saved_email');
    if (savedEmail) {
      email.value = savedEmail;
      if (remember) {
        remember.checked = true;
      }
    }
  }

  // Initially show login
  showSection(loginSection);
});

// Calculator logic from script.js
const tierRules = [
  {
    tier: "Bronze",
    closings: "3",
    preApproval: "3",
    teamSplitTeamPct: 50,
    teamSplitAgentPct: 50,
    personalSphereTeamPct: 25,
    personalSphereAgentPct: 75,
  },
  {
    tier: "Silver",
    closings: "4-5",
    preApproval: "4-5",
    teamSplitTeamPct: 50,
    teamSplitAgentPct: 50,
    personalSphereTeamPct: 20,
    personalSphereAgentPct: 80,
  },
  {
    tier: "Gold",
    closings: "6-7",
    preApproval: "6-7",
    teamSplitTeamPct: 50,
    teamSplitAgentPct: 50,
    personalSphereTeamPct: 15,
    personalSphereAgentPct: 85,
  },
  {
    tier: "Platinum",
    closings: "8-9",
    preApproval: "8-9",
    teamSplitTeamPct: 50,
    teamSplitAgentPct: 50,
    personalSphereTeamPct: 10,
    personalSphereAgentPct: 90,
  },
  {
    tier: "Diamond",
    closings: "10+",
    preApproval: "10+",
    teamSplitTeamPct: 50,
    teamSplitAgentPct: 50,
    personalSphereTeamPct: 5,
    personalSphereAgentPct: 95,
  },
];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function parseLocalDateInput(value) {
  const raw = String(value).trim();
  const dateParts = raw.split("-");
  if (dateParts.length === 3) {
    const year = Number(dateParts[0]);
    const monthIndex = Number(dateParts[1]) - 1;
    const day = Number(dateParts[2]);
    if (Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day)) {
      return null;
    }
    const parsed = new Date(year, monthIndex, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== monthIndex ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  }

  const parts = raw.split("/");
  if (parts.length !== 3) {
    return null;
  }
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  const year = Number(parts[2]);
  const monthIndex = month - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day)) {
    return null;
  }
  const parsed = new Date(year, monthIndex, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function buildAmortizationSchedule(
  loanAmount,
  annualInterestRate,
  loanTermYears,
  monthlyPayment,
  paymentStartDate,
  extraPaymentPerMonth
) {
  const monthlyRate = annualInterestRate / 100 / 12;
  const scheduledPayments = loanTermYears * 12;
  const rows = [];
  let balance = loanAmount;
  let cumulativeInterest = 0;
  let earlyPaymentsApplied = 0;
  const configuredExtraPayment = Math.max(0, extraPaymentPerMonth);

  for (let paymentNo = 1; paymentNo <= scheduledPayments && balance > 0.0001; paymentNo += 1) {
    const beginningBalance = balance;
    const interest = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;
    let principal = monthlyPayment - interest + configuredExtraPayment;
    let totalPayment = monthlyPayment + configuredExtraPayment;

    if (principal > beginningBalance) {
      principal = beginningBalance;
      totalPayment = principal + interest;
    }
    const extraPaymentApplied = Math.max(0, totalPayment - monthlyPayment);

    balance = Math.max(0, beginningBalance - principal);
    cumulativeInterest += interest;
    earlyPaymentsApplied += extraPaymentApplied;

    const paymentDate = new Date(paymentStartDate);
    paymentDate.setMonth(paymentDate.getMonth() + (paymentNo - 1));

    rows.push({
      paymentNo,
      paymentDate: formatDate(paymentDate),
      beginningBalance,
      scheduledPayment: monthlyPayment,
      extraPayment: extraPaymentApplied,
      totalPayment,
      principal,
      interest,
      endingBalance: balance,
      cumulativeInterest,
    });
  }

  const actualPayments = rows.length;
  const yearsSaved = Math.max(0, (scheduledPayments - actualPayments) / 12);

  return {
    rows,
    scheduledPayments,
    actualPayments,
    yearsSaved,
    totalInterest: cumulativeInterest,
    totalEarlyPaymentsApplied: earlyPaymentsApplied,
    extraPaymentPerMonth: configuredExtraPayment,
  };
}

function writeWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const lines =
    typeof doc.splitTextToSize === "function" ? doc.splitTextToSize(text, maxWidth) : [text];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function formatSplitLabel(teamPct, agentPct) {
  return `${teamPct}%(Team) - ${agentPct}%(Agent)`;
}

function formatSplitStack(teamPct, agentPct) {
  return `
    <div class="split-stack">
      <span>${teamPct}%(Team)</span>
      <span>-</span>
      <span>${agentPct}%(Agent)</span>
    </div>
  `;
}

function getTierRuleByClosings(closingsPerQuarter) {
  if (closingsPerQuarter >= 10) {
    return tierRules.find((rule) => rule.tier === "Diamond");
  }
  if (closingsPerQuarter >= 8) {
    return tierRules.find((rule) => rule.tier === "Platinum");
  }
  if (closingsPerQuarter >= 6) {
    return tierRules.find((rule) => rule.tier === "Gold");
  }
  if (closingsPerQuarter >= 4) {
    return tierRules.find((rule) => rule.tier === "Silver");
  }
  return tierRules.find((rule) => rule.tier === "Bronze");
}

function getTierPdfFillColor(tierName) {
  const key = String(tierName).toLowerCase();
  if (key === "bronze") {
    return [203, 131, 53];
  }
  if (key === "silver") {
    return [182, 182, 184];
  }
  if (key === "gold") {
    return [246, 216, 0];
  }
  if (key === "platinum") {
    return [212, 212, 212];
  }
  return [156, 207, 221];
}

function drawPdfTierMatrix(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth * 0.82;
  const contentHeight = pageHeight * 0.82;
  const contentX = (pageWidth - contentWidth) / 2;
  const contentY = (pageHeight - contentHeight) / 2;

  const labelsWidth = 72;
  const columnGap = 4;
  const tableWidth = contentWidth - labelsWidth - columnGap;
  const tableX = contentX + labelsWidth + columnGap;
  const leftLabelsX = contentX;
  const colWidth = tableWidth / tierRules.length;

  const unitHeight = contentHeight / 7.1;
  const headerHeight = unitHeight * 1.05;
  const standardRowHeight = unitHeight * 1.05;
  const tallRowHeight = unitHeight * 1.85;
  const rowHeights = [
    headerHeight,
    standardRowHeight,
    standardRowHeight,
    tallRowHeight,
    tallRowHeight,
  ];
  const totalTableHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  const tableTopY = contentY + (contentHeight - totalTableHeight) / 2;

  const rowStarts = [];
  let runningY = tableTopY;
  rowHeights.forEach((h) => {
    rowStarts.push(runningY);
    runningY += h;
  });

  const labels = [
    "Closings per Quarter",
    "3 Closing or ZHL Pre-Approval per Quarter",
    "Team Split Adjustment",
    "Personal Sphere Adjustment",
  ];

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);

  labels.forEach((label, idx) => {
    const rowY = rowStarts[idx + 1];
    const rowH = rowHeights[idx + 1];
    const textLines = label.length > 34 ? doc.splitTextToSize(label, labelsWidth - 6) : [label];
    const textBlockHeight = textLines.length * 4.6;
    const textY = rowY + rowH / 2 - textBlockHeight / 2 + 3.6;
    doc.text(textLines, leftLabelsX + 1.5, textY, { align: "left" });
  });

  tierRules.forEach((rule, idx) => {
    const x = tableX + idx * colWidth;
    const fill = getTierPdfFillColor(rule.tier);

    rowHeights.forEach((h, rowIdx) => {
      const y = rowStarts[rowIdx];
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(17, 17, 17);
      doc.setLineWidth(0.6);
      doc.rect(x, y, colWidth, h, "FD");
    });

    doc.setTextColor(17, 17, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(rule.tier, x + colWidth / 2, rowStarts[0] + headerHeight / 2 + 4.2, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(rule.closings, x + colWidth / 2, rowStarts[1] + standardRowHeight / 2 + 4.4, {
      align: "center",
    });
    doc.text(rule.preApproval, x + colWidth / 2, rowStarts[2] + standardRowHeight / 2 + 4.4, {
      align: "center",
    });

    doc.setFontSize(9);
    doc.text(`${rule.teamSplitTeamPct}%(Team)`, x + colWidth / 2, rowStarts[3] + tallRowHeight * 0.34, {
      align: "center",
    });
    doc.text("-", x + colWidth / 2, rowStarts[3] + tallRowHeight * 0.52, { align: "center" });
    doc.text(`${rule.teamSplitAgentPct}%(Agent)`, x + colWidth / 2, rowStarts[3] + tallRowHeight * 0.75, {
      align: "center",
    });

    doc.text(`${rule.personalSphereTeamPct}%(Team)`, x + colWidth / 2, rowStarts[4] + tallRowHeight * 0.34, {
      align: "center",
    });
    doc.text("-", x + colWidth / 2, rowStarts[4] + tallRowHeight * 0.52, { align: "center" });
    doc.text(`${rule.personalSphereAgentPct}%(Agent)`, x + colWidth / 2, rowStarts[4] + tallRowHeight * 0.75, {
      align: "center",
    });
  });

  doc.setDrawColor(17, 17, 17);
  doc.setLineWidth(0.8);
  doc.rect(tableX, tableTopY, tableWidth, rowHeights.reduce((sum, h) => sum + h, 0));
  doc.setFont("helvetica", "normal");
  doc.setTextColor(31, 41, 55);
}

function showStartupError(message) {
  console.error(message);
  const main = document.querySelector("main");
  if (!main) {
    return;
  }
  const error = document.createElement("p");
  error.textContent = message;
  error.style.color = "#b91c1c";
  error.style.fontWeight = "700";
  error.style.marginTop = "12px";
  main.appendChild(error);
}

async function exportElementAsPdf(element, fileName) {
  if (!window.html2canvas) {
    alert("Screenshot library did not load. Please refresh and try again.");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library did not load. Please refresh and try again.");
    return;
  }

  let canvas;
  document.body.classList.add("pdf-capture");
  try {
    canvas = await window.html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  } finally {
    document.body.classList.remove("pdf-capture");
  }

  const { jsPDF } = window.jspdf;
  const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const printableWidth = pageWidth - margin * 2;
  const scaledImageHeight = (canvas.height * printableWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  let heightLeft = scaledImageHeight;
  let position = margin;
  doc.addImage(imgData, "PNG", margin, position, printableWidth, scaledImageHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    doc.addPage();
    position = margin - (scaledImageHeight - heightLeft);
    doc.addImage(imgData, "PNG", margin, position, printableWidth, scaledImageHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  doc.save(fileName);
}

// Rest of script.js logic
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calculator-form");
  const commissionPageSection = document.getElementById("commission-page");
  const commissionSurface = document.getElementById("commission-surface");
  const mortgagePageSection = document.getElementById("mortgage-page");
  const mortgageSurface = document.getElementById("mortgage-surface");
  const showCommissionPageButton = document.getElementById("show-commission-page");
  const showMortgagePageButton = document.getElementById("show-mortgage-page");
  const agentCommissionEl = document.getElementById("agent-commission");
  const brokerAmountEl = document.getElementById("broker-amount");
  const netIncomeEl = document.getElementById("net-income");
  const tierLevelResultEl = document.getElementById("tier-level-result");
  const teamSplitAdjustmentEl = document.getElementById("team-split-adjustment");
  const personalSphereAdjustmentEl = document.getElementById("personal-sphere-adjustment");
  const downloadPdfButton = document.getElementById("download-pdf");
  const viewPage2Button = document.getElementById("view-page-2");
  const tierGuideSection = document.getElementById("tier-guide");
  const tierGuideList = document.getElementById("tier-guide-list");
  const mortgageCalculatorSection = document.getElementById("mortgage-page");
  const mortgageForm = document.getElementById("mortgage-form");
  const monthlyPaymentEl = document.getElementById("monthly-payment");
  const downloadMortgagePdfButton = document.getElementById("download-mortgage-pdf");
  const downloadAmortizationPdfButton = document.getElementById("download-amortization-pdf");
  const toggleAmortizationButton = document.getElementById("toggle-amortization");
  const amortizationSection = document.getElementById("amortization-section");
  const amortizationBody = document.getElementById("amortization-body");
  const paymentStartDateInput = document.getElementById("payment-start-date");
  const extraPaymentInput = document.getElementById("extra-payment");
  const amLoanAmountEl = document.getElementById("am-loan-amount");
  const amInterestRateEl = document.getElementById("am-interest-rate");
  const amLoanTermEl = document.getElementById("am-loan-term");
  const amPaymentsPerYearEl = document.getElementById("am-payments-per-year");
  const amPaymentStartDateEl = document.getElementById("am-payment-start-date");
  const amExtraPaymentEl = document.getElementById("am-extra-payment");
  const amTotalEarlyPaymentsAppliedEl = document.getElementById("am-total-early-payments-applied");
  const amTotalEarlyPaymentsEl = document.getElementById("am-total-early-payments");
  const amScheduledPaymentEl = document.getElementById("am-scheduled-payment");
  const amScheduledCountEl = document.getElementById("am-scheduled-count");
  const amActualCountEl = document.getElementById("am-actual-count");
  const amYearsSavedEl = document.getElementById("am-years-saved");
  const amTotalInterestEl = document.getElementById("am-total-interest");

  if (
    !form ||
    !commissionPageSection ||
    !commissionSurface ||
    !mortgagePageSection ||
    !mortgageSurface ||
    !showCommissionPageButton ||
    !showMortgagePageButton ||
    !agentCommissionEl ||
    !brokerAmountEl ||
    !netIncomeEl ||
    !tierLevelResultEl ||
    !teamSplitAdjustmentEl ||
    !personalSphereAdjustmentEl ||
    !downloadPdfButton ||
    !viewPage2Button ||
    !tierGuideSection ||
    !tierGuideList ||
    !mortgageCalculatorSection ||
    !mortgageForm ||
    !monthlyPaymentEl ||
    !downloadMortgagePdfButton ||
    !downloadAmortizationPdfButton ||
    !toggleAmortizationButton ||
    !amortizationSection ||
    !amortizationBody ||
    !paymentStartDateInput ||
    !extraPaymentInput ||
    !amLoanAmountEl ||
    !amInterestRateEl ||
    !amLoanTermEl ||
    !amPaymentsPerYearEl ||
    !amPaymentStartDateEl ||
    !amExtraPaymentEl ||
    !amTotalEarlyPaymentsAppliedEl ||
    !amTotalEarlyPaymentsEl ||
    !amScheduledPaymentEl ||
    !amScheduledCountEl ||
    !amActualCountEl ||
    !amYearsSavedEl ||
    !amTotalInterestEl
  ) {
    showStartupError("App failed to start: missing required page elements.");
    return;
  }

  let latestCalculation = null;
  let latestMortgageCalculation = null;
  let isTierGuideVisible = false;
  let isAmortizationVisible = false;

  if (!paymentStartDateInput.value) {
    paymentStartDateInput.valueAsDate = new Date();
  }

  tierGuideList.innerHTML = `
    <div class="tier-guide-landscape">
      <div class="tier-matrix">
      <div class="tier-row-labels">
        <div class="tier-row-label tier-row-spacer"></div>
        <div class="tier-row-label">Closings per Quarter</div>
        <div class="tier-row-label">3 Closing or ZHL Pre-Approval per Quarter</div>
        <div class="tier-row-label">Team Split Adjustment</div>
        <div class="tier-row-label">Personal Sphere Adjustment</div>
      </div>
      <div class="tier-table-wrap">
        <table class="tier-table">
          <thead>
            <tr>
              <th>Bronze</th>
              <th>Silver</th>
              <th>Gold</th>
              <th>Platinum</th>
              <th>Diamond</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>3</td>
              <td>4-5</td>
              <td>6-7</td>
              <td>8-9</td>
              <td>10+</td>
            </tr>
            <tr>
              <td>3</td>
              <td>4-5</td>
              <td>6-7</td>
              <td>8-9</td>
              <td>10+</td>
            </tr>
            <tr>
              <td>${formatSplitStack(50, 50)}</td>
              <td>${formatSplitStack(50, 50)}</td>
              <td>${formatSplitStack(50, 50)}</td>
              <td>${formatSplitStack(50, 50)}</td>
              <td>${formatSplitStack(50, 50)}</td>
            </tr>
            <tr>
              <td>${formatSplitStack(25, 75)}</td>
              <td>${formatSplitStack(20, 80)}</td>
              <td>${formatSplitStack(15, 85)}</td>
              <td>${formatSplitStack(10, 90)}</td>
              <td>${formatSplitStack(5, 95)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  function showCommissionPage() {
    commissionPageSection.style.display = "block";
    mortgagePageSection.style.display = "none";
    showCommissionPageButton.classList.add("active");
    showMortgagePageButton.classList.remove("active");
  }

  function showMortgagePage() {
    commissionPageSection.style.display = "none";
    mortgagePageSection.style.display = "block";
    showCommissionPageButton.classList.remove("active");
    showMortgagePageButton.classList.add("active");
  }

  showCommissionPageButton.addEventListener("click", showCommissionPage);
  showMortgagePageButton.addEventListener("click", showMortgagePage);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const salePrice = Number(document.getElementById("sale-price").value);
    const commissionRate = Number(document.getElementById("commission-rate").value);
    const brokerSplit = Number(document.getElementById("broker-split").value);
    const closingsPerQuarter = Number(document.getElementById("closings-per-quarter").value);

    if (salePrice <= 0 || commissionRate <= 0 || brokerSplit < 0 || brokerSplit > 100 || closingsPerQuarter < 0) {
      alert("Please enter valid values.");
      return;
    }

    const grossCommission = salePrice * (commissionRate / 100);
    const brokerAmount = grossCommission * (brokerSplit / 100);
    const agentCommission = grossCommission - brokerAmount;

    const tierRule = getTierRuleByClosings(closingsPerQuarter);
    const teamSplitAdjustment = agentCommission * (tierRule.teamSplitTeamPct / 100);
    const personalSphereAdjustment = agentCommission * (tierRule.personalSphereTeamPct / 100);
    const netIncome = agentCommission - teamSplitAdjustment - personalSphereAdjustment;

    agentCommissionEl.textContent = formatCurrency(agentCommission);
    brokerAmountEl.textContent = formatCurrency(brokerAmount);
    netIncomeEl.textContent = formatCurrency(netIncome);
    tierLevelResultEl.textContent = tierRule.tier;
    teamSplitAdjustmentEl.textContent = formatCurrency(teamSplitAdjustment);
    personalSphereAdjustmentEl.textContent = formatCurrency(personalSphereAdjustment);

    downloadPdfButton.disabled = false;
    latestCalculation = {
      salePrice,
      commissionRate,
      brokerSplit,
      closingsPerQuarter,
      grossCommission,
      brokerAmount,
      agentCommission,
      tierRule,
      teamSplitAdjustment,
      personalSphereAdjustment,
      netIncome,
    };
  });

  downloadPdfButton.addEventListener("click", () => {
    if (!latestCalculation) {
      alert("Please calculate first.");
      return;
    }
    exportElementAsPdf(commissionSurface, "commission-calculation.pdf");
  });

  viewPage2Button.addEventListener("click", () => {
    isTierGuideVisible = !isTierGuideVisible;
    tierGuideSection.style.display = isTierGuideVisible ? "block" : "none";
    viewPage2Button.textContent = isTierGuideVisible ? "Hide Page 2: Tier Guide" : "Page 2: Tier Guide";
  });

  mortgageForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const loanAmount = Number(document.getElementById("loan-amount").value);
    const annualInterestRate = Number(document.getElementById("annual-interest-rate").value);
    const loanTermYears = Number(document.getElementById("loan-term-years").value);
    const paymentStartDate = parseLocalDateInput(document.getElementById("payment-start-date").value);
    const extraPayment = Number(document.getElementById("extra-payment").value);

    if (loanAmount <= 0 || annualInterestRate < 0 || loanTermYears <= 0 || !paymentStartDate) {
      alert("Please enter valid values.");
      return;
    }

    const monthlyRate = annualInterestRate / 100 / 12;
    const numPayments = loanTermYears * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    monthlyPaymentEl.textContent = formatCurrency(monthlyPayment);
    downloadMortgagePdfButton.disabled = false;
    toggleAmortizationButton.disabled = false;

    latestMortgageCalculation = {
      loanAmount,
      annualInterestRate,
      loanTermYears,
      paymentStartDate,
      extraPayment,
      monthlyPayment,
    };
  });

  downloadMortgagePdfButton.addEventListener("click", () => {
    if (!latestMortgageCalculation) {
      alert("Please calculate first.");
      return;
    }
    exportElementAsPdf(mortgageSurface, "mortgage-calculation.pdf");
  });

  toggleAmortizationButton.addEventListener("click", () => {
    if (!latestMortgageCalculation) {
      alert("Please calculate first.");
      return;
    }

    isAmortizationVisible = !isAmortizationVisible;
    amortizationSection.style.display = isAmortizationVisible ? "block" : "none";
    toggleAmortizationButton.textContent = isAmortizationVisible ? "Hide Amortization Schedule" : "Show Amortization Schedule";

    if (isAmortizationVisible) {
      const { loanAmount, annualInterestRate, loanTermYears, paymentStartDate, extraPayment, monthlyPayment } = latestMortgageCalculation;
      const schedule = buildAmortizationSchedule(loanAmount, annualInterestRate, loanTermYears, monthlyPayment, paymentStartDate, extraPayment);

      amLoanAmountEl.textContent = formatCurrency(loanAmount);
      amInterestRateEl.textContent = formatPercent(annualInterestRate);
      amLoanTermEl.textContent = loanTermYears;
      amPaymentsPerYearEl.textContent = "12";
      amPaymentStartDateEl.textContent = formatDate(paymentStartDate);
      amExtraPaymentEl.textContent = formatCurrency(extraPayment);
      amTotalEarlyPaymentsAppliedEl.textContent = formatCurrency(schedule.totalEarlyPaymentsApplied);
      amTotalEarlyPaymentsEl.textContent = formatCurrency(schedule.totalEarlyPaymentsApplied);
      amScheduledPaymentEl.textContent = formatCurrency(monthlyPayment);
      amScheduledCountEl.textContent = schedule.scheduledPayments;
      amActualCountEl.textContent = schedule.actualPayments;
      amYearsSavedEl.textContent = schedule.yearsSaved.toFixed(2);
      amTotalInterestEl.textContent = formatCurrency(schedule.totalInterest);

      amortizationBody.innerHTML = "";
      schedule.rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.paymentNo}</td>
          <td>${row.paymentDate}</td>
          <td>${formatCurrency(row.beginningBalance)}</td>
          <td>${formatCurrency(row.scheduledPayment)}</td>
          <td>${formatCurrency(row.extraPayment)}</td>
          <td>${formatCurrency(row.totalPayment)}</td>
          <td>${formatCurrency(row.principal)}</td>
          <td>${formatCurrency(row.interest)}</td>
          <td>${formatCurrency(row.endingBalance)}</td>
          <td>${formatCurrency(row.cumulativeInterest)}</td>
        `;
        amortizationBody.appendChild(tr);
      });

      downloadAmortizationPdfButton.disabled = false;
    }
  });

  downloadAmortizationPdfButton.addEventListener("click", () => {
    if (!isAmortizationVisible) {
      alert("Please show the amortization schedule first.");
      return;
    }
    exportElementAsPdf(amortizationSection, "mortgage-amortization.pdf");
  });
});