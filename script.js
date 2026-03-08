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
  totalEarlyPayments
) {
  const monthlyRate = annualInterestRate / 100 / 12;
  const scheduledPayments = loanTermYears * 12;
  const monthlyEarlyPayment = scheduledPayments > 0 ? totalEarlyPayments / scheduledPayments : 0;
  const rows = [];
  let balance = loanAmount;
  let cumulativeInterest = 0;
  let earlyPaymentsApplied = 0;
  let remainingEarlyPayments = totalEarlyPayments;

  for (let paymentNo = 1; paymentNo <= scheduledPayments && balance > 0.0001; paymentNo += 1) {
    const beginningBalance = balance;
    const interest = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;
    const extraPayment = Math.min(monthlyEarlyPayment, remainingEarlyPayments);
    let principal = monthlyPayment - interest + extraPayment;
    let totalPayment = monthlyPayment + extraPayment;

    if (principal > beginningBalance) {
      principal = beginningBalance;
      totalPayment = principal + interest;
    }

    balance = Math.max(0, beginningBalance - principal);
    cumulativeInterest += interest;
    earlyPaymentsApplied += extraPayment;
    remainingEarlyPayments = Math.max(0, remainingEarlyPayments - extraPayment);

    const paymentDate = new Date(paymentStartDate);
    paymentDate.setMonth(paymentDate.getMonth() + (paymentNo - 1));

    rows.push({
      paymentNo,
      paymentDate: formatDate(paymentDate),
      beginningBalance,
      scheduledPayment: monthlyPayment,
      extraPayment,
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
  const totalEarlyPaymentsInput = document.getElementById("total-early-payments");
  const amLoanAmountEl = document.getElementById("am-loan-amount");
  const amInterestRateEl = document.getElementById("am-interest-rate");
  const amLoanTermEl = document.getElementById("am-loan-term");
  const amPaymentsPerYearEl = document.getElementById("am-payments-per-year");
  const amPaymentStartDateEl = document.getElementById("am-payment-start-date");
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
    !totalEarlyPaymentsInput ||
    !amLoanAmountEl ||
    !amInterestRateEl ||
    !amLoanTermEl ||
    !amPaymentsPerYearEl ||
    !amPaymentStartDateEl ||
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
        <table class="tier-table" aria-label="Quarterly tier split table">
          <thead>
            <tr>
              ${tierRules
                .map(
                  (rule) => `
                    <th class="tier-col tier-${rule.tier.toLowerCase()}">${rule.tier}</th>
                  `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${tierRules
                .map(
                  (rule) => `
                    <td class="tier-col tier-${rule.tier.toLowerCase()}">${rule.closings}</td>
                  `
                )
                .join("")}
            </tr>
            <tr>
              ${tierRules
                .map(
                  (rule) => `
                    <td class="tier-col tier-${rule.tier.toLowerCase()}">${rule.preApproval}</td>
                  `
                )
                .join("")}
            </tr>
            <tr>
              ${tierRules
                .map(
                  (rule) => `
                    <td class="tier-col tier-${rule.tier.toLowerCase()}">
                      ${formatSplitStack(rule.teamSplitTeamPct, rule.teamSplitAgentPct)}
                    </td>
                  `
                )
                .join("")}
            </tr>
            <tr>
              ${tierRules
                .map(
                  (rule) => `
                    <td class="tier-col tier-${rule.tier.toLowerCase()}">
                      ${formatSplitStack(rule.personalSphereTeamPct, rule.personalSphereAgentPct)}
                    </td>
                  `
                )
                .join("")}
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  `;

  viewPage2Button.addEventListener("click", () => {
    isTierGuideVisible = !isTierGuideVisible;
    tierGuideSection.hidden = !isTierGuideVisible;
    viewPage2Button.textContent = isTierGuideVisible
      ? "Hide Page 2: Tier Guide"
      : "Page 2: Tier Guide";
  });

  showCommissionPageButton.addEventListener("click", () => {
    commissionPageSection.hidden = false;
    mortgagePageSection.hidden = true;
    showCommissionPageButton.classList.add("active");
    showMortgagePageButton.classList.remove("active");
  });

  showMortgagePageButton.addEventListener("click", () => {
    commissionPageSection.hidden = true;
    mortgagePageSection.hidden = false;
    showMortgagePageButton.classList.add("active");
    showCommissionPageButton.classList.remove("active");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const salePrice = Number(formData.get("salePrice"));
    const commissionRate = Number(formData.get("commissionRate"));
    const brokerSplit = Number(formData.get("brokerSplit"));
    const closingsPerQuarter = Number(formData.get("closingsPerQuarter"));
    const selectedTierRule = getTierRuleByClosings(closingsPerQuarter);

    if (
      Number.isNaN(salePrice) ||
      Number.isNaN(commissionRate) ||
      Number.isNaN(brokerSplit) ||
      Number.isNaN(closingsPerQuarter) ||
      !selectedTierRule
    ) {
      showStartupError("Invalid input values. Please enter numbers in all fields.");
      return;
    }

    const agentCommission = salePrice * (commissionRate / 100);
    const brokerAmount = agentCommission * (brokerSplit / 100);
    const netIncome = agentCommission - brokerAmount;
    const teamSplitTeamAmount = agentCommission * (selectedTierRule.teamSplitTeamPct / 100);
    const teamSplitAgentAmount = agentCommission * (selectedTierRule.teamSplitAgentPct / 100);
    const personalSphereTeamAmount =
      agentCommission * (selectedTierRule.personalSphereTeamPct / 100);
    const personalSphereAgentAmount =
      agentCommission * (selectedTierRule.personalSphereAgentPct / 100);

    latestCalculation = {
      salePrice,
      commissionRate,
      brokerSplit,
      closingsPerQuarter,
      tierLevel: selectedTierRule.tier,
      agentCommission,
      brokerAmount,
      netIncome,
      teamSplitTeamPct: selectedTierRule.teamSplitTeamPct,
      teamSplitAgentPct: selectedTierRule.teamSplitAgentPct,
      personalSphereTeamPct: selectedTierRule.personalSphereTeamPct,
      personalSphereAgentPct: selectedTierRule.personalSphereAgentPct,
      teamSplitTeamAmount,
      teamSplitAgentAmount,
      personalSphereTeamAmount,
      personalSphereAgentAmount,
    };

    agentCommissionEl.textContent = formatCurrency(agentCommission);
    brokerAmountEl.textContent = formatCurrency(brokerAmount);
    netIncomeEl.textContent = formatCurrency(netIncome);
    tierLevelResultEl.textContent = selectedTierRule.tier;
    teamSplitAdjustmentEl.textContent = `Team ${formatCurrency(teamSplitTeamAmount)} | Agent ${formatCurrency(teamSplitAgentAmount)}`;
    personalSphereAdjustmentEl.textContent = `Team ${formatCurrency(personalSphereTeamAmount)} | Agent ${formatCurrency(personalSphereAgentAmount)}`;
    downloadPdfButton.disabled = false;
  });

  mortgageForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const mortgageFormData = new FormData(mortgageForm);
    const loanAmount = Number(mortgageFormData.get("loanAmount"));
    const annualInterestRate = Number(mortgageFormData.get("annualInterestRate"));
    const loanTermYears = Number(mortgageFormData.get("loanTermYears"));
    const paymentStartDateValue = String(mortgageFormData.get("paymentStartDate"));
    const totalEarlyPayments = Number(mortgageFormData.get("totalEarlyPayments"));
    const paymentStartDate = parseLocalDateInput(paymentStartDateValue);

    if (
      Number.isNaN(loanAmount) ||
      Number.isNaN(annualInterestRate) ||
      Number.isNaN(loanTermYears) ||
      Number.isNaN(totalEarlyPayments) ||
      !paymentStartDate ||
      Number.isNaN(paymentStartDate.getTime()) ||
      loanAmount <= 0 ||
      loanTermYears <= 0 ||
      annualInterestRate < 0 ||
      totalEarlyPayments < 0
    ) {
      showStartupError("Invalid mortgage values. Please enter valid numbers.");
      return;
    }

    const monthlyRate = annualInterestRate / 100 / 12;
    const totalPayments = loanTermYears * 12;
    let monthlyPayment = 0;

    if (monthlyRate === 0) {
      monthlyPayment = loanAmount / totalPayments;
    } else {
      const factor = Math.pow(1 + monthlyRate, totalPayments);
      monthlyPayment = (loanAmount * monthlyRate * factor) / (factor - 1);
    }

    const amortization = buildAmortizationSchedule(
      loanAmount,
      annualInterestRate,
      loanTermYears,
      monthlyPayment,
      paymentStartDate,
      totalEarlyPayments
    );

    amortizationBody.innerHTML = amortization.rows
      .map(
        (row) => `
        <tr>
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
        </tr>
      `
      )
      .join("");

    amLoanAmountEl.textContent = formatCurrency(loanAmount);
    amInterestRateEl.textContent = formatPercent(annualInterestRate);
    amLoanTermEl.textContent = String(loanTermYears);
    amPaymentsPerYearEl.textContent = "12";
    amPaymentStartDateEl.textContent = formatDate(paymentStartDate);
    amTotalEarlyPaymentsEl.textContent = formatCurrency(totalEarlyPayments);
    amScheduledPaymentEl.textContent = formatCurrency(monthlyPayment);
    amScheduledCountEl.textContent = String(amortization.scheduledPayments);
    amActualCountEl.textContent = String(amortization.actualPayments);
    amYearsSavedEl.textContent = amortization.yearsSaved.toFixed(2);
    amTotalInterestEl.textContent = formatCurrency(amortization.totalInterest);

    latestMortgageCalculation = {
      loanAmount,
      annualInterestRate,
      loanTermYears,
      paymentStartDate: formatDate(paymentStartDate),
      totalEarlyPayments,
      monthlyPayment,
      amortization,
    };
    monthlyPaymentEl.textContent = formatCurrency(monthlyPayment);
    downloadMortgagePdfButton.disabled = false;
    downloadAmortizationPdfButton.disabled = false;
    toggleAmortizationButton.disabled = false;
    isAmortizationVisible = false;
    amortizationSection.hidden = true;
    toggleAmortizationButton.textContent = "Show Amortization Schedule";
  });

  toggleAmortizationButton.addEventListener("click", () => {
    if (!latestMortgageCalculation) {
      return;
    }

    isAmortizationVisible = !isAmortizationVisible;
    amortizationSection.hidden = !isAmortizationVisible;
    toggleAmortizationButton.textContent = isAmortizationVisible
      ? "Hide Amortization Schedule"
      : "Show Amortization Schedule";
  });

  downloadPdfButton.addEventListener("click", async () => {
    try {
      if (!latestCalculation) {
        return;
      }
      await exportElementAsPdf(commissionPageSection, "commission-calculator-view.pdf");
    } catch (error) {
      console.error("Failed to export commission view:", error);
      alert("Something went wrong while creating the commission PDF.");
    }
  });

  downloadMortgagePdfButton.addEventListener("click", async () => {
    try {
      if (!latestMortgageCalculation) {
        return;
      }
      await exportElementAsPdf(mortgagePageSection, "mortgage-calculator-view.pdf");
    } catch (error) {
      console.error("Failed to export mortgage view:", error);
      alert("Something went wrong while creating the mortgage PDF.");
    }
  });

  downloadAmortizationPdfButton.addEventListener("click", () => {
    try {
      if (!latestMortgageCalculation || !latestMortgageCalculation.amortization) {
        return;
      }

      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF library did not load. Please refresh and try again.");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const rows = latestMortgageCalculation.amortization.rows;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const top = 10;
      const rowHeight = 6;
      const headerRowHeight = 10;
      const headers = [
        "PMT No",
        "Payment Date",
        "Beginning Balance",
        "Scheduled Payment",
        "Extra Payment",
        "Total Payment",
        "Principal",
        "Interest",
        "Ending Balance",
        "Cumulative Interest",
      ];
      const colWidths = [12, 22, 30, 24, 22, 24, 22, 20, 30, 25];
      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const left = (pageWidth - tableWidth) / 2;

      function drawHeader(y) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Amortization Schedule", pageWidth / 2, y, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(
          `Loan: ${formatCurrency(latestMortgageCalculation.loanAmount)} | Rate: ${latestMortgageCalculation.annualInterestRate}% | Term: ${latestMortgageCalculation.loanTermYears} years`,
          pageWidth / 2,
          y + 5,
          { align: "center" }
        );
        doc.text(
          `Start Date: ${latestMortgageCalculation.paymentStartDate} | Total Early Payments: ${formatCurrency(latestMortgageCalculation.totalEarlyPayments)}`,
          pageWidth / 2,
          y + 10,
          { align: "center" }
        );
      }

      function drawTableHeader(y) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        let x = left;
        headers.forEach((header, idx) => {
          doc.rect(x, y, colWidths[idx], headerRowHeight);
          const headerLines = doc.splitTextToSize(header, colWidths[idx] - 2);
          doc.text(headerLines, x + colWidths[idx] / 2, y + 3.8, { align: "center" });
          x += colWidths[idx];
        });
      }

      function drawRow(row, y) {
        const values = [
          String(row.paymentNo),
          row.paymentDate,
          formatCurrency(row.beginningBalance),
          formatCurrency(row.scheduledPayment),
          formatCurrency(row.extraPayment),
          formatCurrency(row.totalPayment),
          formatCurrency(row.principal),
          formatCurrency(row.interest),
          formatCurrency(row.endingBalance),
          formatCurrency(row.cumulativeInterest),
        ];

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.4);
        let x = left;
        values.forEach((value, idx) => {
          doc.rect(x, y, colWidths[idx], rowHeight);
          doc.text(value, x + colWidths[idx] / 2, y + 4.2, { align: "center" });
          x += colWidths[idx];
        });
      }

      let y = top;
      drawHeader(y);
      y += 16;
      drawTableHeader(y);
      y += headerRowHeight;

      rows.forEach((row) => {
        if (y + rowHeight > pageHeight - 10) {
          doc.addPage("a4", "landscape");
          y = top;
          drawHeader(y);
          y += 16;
          drawTableHeader(y);
          y += headerRowHeight;
        }
        drawRow(row, y);
        y += rowHeight;
      });

      doc.save("mortgage-amortization-schedule.pdf");
    } catch (error) {
      console.error("Failed to generate amortization PDF:", error);
      alert("Something went wrong while creating the amortization PDF.");
    }
  });
});

