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

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calculator-form");
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

  if (
    !form ||
    !agentCommissionEl ||
    !brokerAmountEl ||
    !netIncomeEl ||
    !tierLevelResultEl ||
    !teamSplitAdjustmentEl ||
    !personalSphereAdjustmentEl ||
    !downloadPdfButton ||
    !viewPage2Button ||
    !tierGuideSection ||
    !tierGuideList
  ) {
    showStartupError("App failed to start: missing required page elements.");
    return;
  }

  let latestCalculation = null;
  let isTierGuideVisible = false;

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
    const teamSplitTeamAmount = salePrice * (selectedTierRule.teamSplitTeamPct / 100);
    const teamSplitAgentAmount = salePrice * (selectedTierRule.teamSplitAgentPct / 100);
    const personalSphereTeamAmount = salePrice * (selectedTierRule.personalSphereTeamPct / 100);
    const personalSphereAgentAmount = salePrice * (selectedTierRule.personalSphereAgentPct / 100);

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

  downloadPdfButton.addEventListener("click", () => {
    try {
      if (!latestCalculation) {
        return;
      }

      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF library did not load. Please refresh and try again.");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const now = new Date();

      doc.setFontSize(16);
      doc.text("Commission Summary", 20, 20);
      doc.setFontSize(11);
      doc.text(`Generated: ${now.toLocaleString()}`, 20, 30);
      doc.text(`Sale Price: ${formatCurrency(latestCalculation.salePrice)}`, 20, 45);
      doc.text(`Commission Rate: ${latestCalculation.commissionRate}%`, 20, 55);
      doc.text(`Broker Split: ${latestCalculation.brokerSplit}%`, 20, 65);
      doc.text(`Closings Per Quarter: ${latestCalculation.closingsPerQuarter}`, 20, 75);
      doc.text(`Tier Level: ${latestCalculation.tierLevel}`, 20, 85);
      doc.text(
        `Agent Commission: ${formatCurrency(latestCalculation.agentCommission)}`,
        20,
        100
      );
      doc.text(`Broker Amount: ${formatCurrency(latestCalculation.brokerAmount)}`, 20, 110);
      doc.text(`Net Income: ${formatCurrency(latestCalculation.netIncome)}`, 20, 120);
      doc.text(
        `Team Split Adj: Team ${formatCurrency(latestCalculation.teamSplitTeamAmount)} | Agent ${formatCurrency(latestCalculation.teamSplitAgentAmount)}`,
        20,
        130
      );
      doc.text(
        `Personal Sphere Adj: Team ${formatCurrency(latestCalculation.personalSphereTeamAmount)} | Agent ${formatCurrency(latestCalculation.personalSphereAgentAmount)}`,
        20,
        140
      );
      doc.setFontSize(10);
      doc.text("See page 2 for quarterly tier split guide.", 20, 155);

      doc.addPage("a4", "landscape");
      drawPdfTierMatrix(doc);

      doc.save("commission-summary.pdf");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Something went wrong while creating the PDF. Open Console for details.");
    }
  });
});
