const categories = {
    energia: ["energy-day", "energy-cumulative"],
    potencia: ["power-summary", "power-variation"],
    tensao: ["voltage-summary", "voltage-distribution", "voltage-oscillation"],
    corrente: ["current-summary", "current-distribution", "current-oscillation"],
    anomalias: ["anomaly-power-drop", "anomaly-voltage-change", "anomaly-current-change", "anomaly-power-oscillation", "anomaly-repeated", "anomaly-inconsistency"],
    disponibilidade: ["availability-history", "availability-percent", "availability-interruptions"]
};

const allGraphIds = Object.values(categories).flat();
const graphMeta = {
    "energy-day": ["Energia gerada por intervalo", "Energia integrada conforme o agrupamento selecionado.", "Wh", "bar"],
    "energy-cumulative": ["Energia acumulada", "Energia acumulada conforme o agrupamento selecionado.", "Wh", "line"],
    "power-summary": ["Potência média, mínima e máxima", "Estatísticas de potência em cada intervalo selecionado.", "W", "line"],
    "power-variation": ["Histórico de variações de potência", "Variação percentual média entre leituras consecutivas por intervalo.", "%", "line"],
    "voltage-summary": ["Tensão média, mínima e máxima", "Estatísticas de tensão em cada intervalo selecionado.", "V", "line"],
    "voltage-distribution": ["Distribuição das médias de tensão", "Quantidade de intervalos por valor médio de tensão, ordenada por frequência decrescente.", "intervalos", "hbar"],
    "voltage-oscillation": ["Oscilações de tensão", "Variação média entre leituras consecutivas por intervalo.", "V", "line"],
    "current-summary": ["Corrente média, mínima e máxima", "Estatísticas de corrente em cada intervalo selecionado.", "A", "line"],
    "current-distribution": ["Distribuição das médias de corrente", "Quantidade de intervalos por valor médio de corrente, ordenada por frequência decrescente.", "intervalos", "hbar"],
    "current-oscillation": ["Oscilações de corrente", "Variação média entre leituras consecutivas por intervalo.", "A", "line"],
    "anomaly-power-drop": ["Quedas bruscas de potência", "Quedas superiores a 50%, ignorando leituras de baixa geração.", "W", "bar"],
    "anomaly-voltage-change": ["Alterações significativas de tensão", "Desvios da mediana móvel superiores a 25% e 1 V.", "V", "bar"],
    "anomaly-current-change": ["Alterações significativas de corrente", "Desvios da mediana móvel superiores a 25% e 0,05 A.", "A", "bar"],
    "anomaly-power-oscillation": ["Oscilações excessivas de potência", "Janelas móveis com variação relativa elevada.", "W", "bar"],
    "anomaly-repeated": ["Leituras repetidas", "Sequências de pelo menos quatro leituras elétricas idênticas.", "leituras", "bar"],
    "anomaly-inconsistency": ["Inconsistências elétricas", "Diferença entre potência medida e tensão × corrente acima de 30%.", "W", "bar"],
    "availability-history": ["Histórico de comunicação", "Medições recebidas por intervalo e equipamento.", "medições", "line"],
    "availability-percent": ["Disponibilidade por período", "Percentual estimado disponível e indisponível em cada intervalo.", "%", "bar"],
    "availability-interruptions": ["Quantidade de interrupções", "Intervalos maiores que duas janelas esperadas.", "interrupções", "bar"]
};

module.exports = { categories, allGraphIds, graphMeta };
