const form = document.getElementById("calculator-form");
const agentCommissionEl = document.getElementById("agent-commission");
const brokerAmountEl = document.getElementById("broker-amount");
const netIncomeEl = document.getElementById("net-income");
const downloadPdfButton = document.getElementById("download-pdf");

let latestCalculation = null;

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const salePrice = Number(formData.get("salePrice"));
  const commissionRate = Number(formData.get("commissionRate"));
  const brokerSplit = Number(formData.get("brokerSplit"));

  const agentCommission = salePrice * (commissionRate / 100);
  const brokerAmount = agentCommission * (brokerSplit / 100);
  const netIncome = agentCommission - brokerAmount;

  latestCalculation = {
    salePrice,
    commissionRate,
    brokerSplit,
    agentCommission,
    brokerAmount,
    netIncome,
  };

  agentCommissionEl.textContent = formatCurrency(agentCommission);
  brokerAmountEl.textContent = formatCurrency(brokerAmount);
  netIncomeEl.textContent = formatCurrency(netIncome);
  downloadPdfButton.disabled = false;
});

downloadPdfButton.addEventListener("click", () => {
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
  doc.text(
    `Agent Commission: ${formatCurrency(latestCalculation.agentCommission)}`,
    20,
    80
  );
  doc.text(`Broker Amount: ${formatCurrency(latestCalculation.brokerAmount)}`, 20, 90);
  doc.text(`Net Income: ${formatCurrency(latestCalculation.netIncome)}`, 20, 100);

  doc.save("commission-summary.pdf");
});
