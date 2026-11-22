const categories = {
    energia: ["energy-day", "energy-month", "energy-cumulative", "energy-daily-comparison", "energy-hourly-profile"],
    potencia: ["power-time", "power-hourly-average", "power-daily-max", "power-period-comparison", "power-variation"],
    tensao: ["voltage-time", "voltage-daily-average", "voltage-range", "voltage-distribution", "voltage-oscillation"],
    corrente: ["current-time", "current-daily-average", "current-range", "current-distribution", "current-oscillation"],
    comparacao: ["compare-energy", "compare-power-avg", "compare-power-max", "compare-hour-profile", "compare-voltage", "compare-current"],
    anomalias: ["anomaly-power-drop", "anomaly-voltage-change", "anomaly-current-change", "anomaly-power-oscillation", "anomaly-repeated", "anomaly-inconsistency"],
    disponibilidade: ["availability-history", "availability-percent", "availability-gaps", "availability-interruptions", "availability-longest-gap"]
};

const allGraphIds = Object.values(categories).flat();
const graphMeta = {
    "energy-day": ["Energia gerada agrupada", "Energia integrada por hora, dia ou mês.", "Wh", "bar"],
    "energy-month": ["Energia total agrupada", "Energia total por hora, dia ou mês.", "Wh", "bar"],
    "energy-cumulative": ["Energia acumulada", "Energia acumulada conforme o agrupamento selecionado.", "Wh", "line"],
    "energy-daily-comparison": ["Comparação de energia agrupada", "Energia por equipamento conforme o agrupamento selecionado.", "Wh", "bar"],
    "energy-hourly-profile": ["Perfil de geração agrupado", "Energia integrada por hora, dia ou mês.", "Wh", "line"],
    "power-time": ["Potência ao longo do tempo", "Potência média por intervalo de agrupamento selecionado.", "W", "line"],
    "power-hourly-average": ["Potência média agrupada", "Média das leituras de potência por hora, dia ou mês.", "W", "bar"],
    "power-daily-max": ["Potência máxima agrupada", "Maior leitura de potência por hora, dia ou mês.", "W", "bar"],
    "power-period-comparison": ["Comparação de potência entre períodos", "Potência média em cada intervalo selecionado.", "W", "bar"],
    "power-variation": ["Histórico de variações de potência", "Variação percentual média entre leituras consecutivas por intervalo de agrupamento.", "%", "line"],
    "voltage-time": ["Tensão ao longo do tempo", "Tensão média por intervalo de agrupamento selecionado.", "V", "line"],
    "voltage-daily-average": ["Tensão média agrupada", "Tensão média por hora, dia ou mês.", "V", "line"],
    "voltage-range": ["Tensão mínima e máxima", "Valores mínimo e máximo por intervalo.", "V", "line"],
    "voltage-distribution": ["Distribuição das médias de tensão", "Quantidade de intervalos por valor médio de tensão, ordenada por frequência decrescente.", "intervalos", "hbar"],
    "voltage-oscillation": ["Oscilações de tensão", "Variação média entre leituras consecutivas por intervalo de agrupamento.", "V", "line"],
    "current-time": ["Corrente ao longo do tempo", "Corrente média por intervalo de agrupamento selecionado.", "A", "line"],
    "current-daily-average": ["Corrente média agrupada", "Corrente média por hora, dia ou mês.", "A", "line"],
    "current-range": ["Corrente mínima e máxima", "Valores mínimo e máximo por intervalo.", "A", "line"],
    "current-distribution": ["Distribuição das médias de corrente", "Quantidade de intervalos por valor médio de corrente, ordenada por frequência decrescente.", "intervalos", "hbar"],
    "current-oscillation": ["Oscilações de corrente", "Variação média entre leituras consecutivas por intervalo de agrupamento.", "A", "line"],
    "compare-energy": ["Energia por equipamento", "Energia integrada separadamente para cada equipamento.", "Wh", "bar"],
    "compare-power-avg": ["Potência média por equipamento", "Média de potência sem combinar equipamentos.", "W", "bar"],
    "compare-power-max": ["Potência máxima por equipamento", "Maior leitura observada em cada equipamento.", "W", "bar"],
    "compare-hour-profile": ["Perfil horário por equipamento", "Média de potência em cada hora para cada equipamento.", "W", "line"],
    "compare-voltage": ["Tensão por equipamento", "Tensão média de cada equipamento selecionado.", "V", "bar"],
    "compare-current": ["Corrente por equipamento", "Corrente média de cada equipamento selecionado.", "A", "bar"],
    "anomaly-power-drop": ["Quedas bruscas de potência", "Quedas superiores a 50%, ignorando leituras de baixa geração.", "W", "bar"],
    "anomaly-voltage-change": ["Alterações significativas de tensão", "Desvios da mediana móvel superiores a 25% e 1 V.", "V", "bar"],
    "anomaly-current-change": ["Alterações significativas de corrente", "Desvios da mediana móvel superiores a 25% e 0,05 A.", "A", "bar"],
    "anomaly-power-oscillation": ["Oscilações excessivas de potência", "Janelas móveis com variação relativa elevada.", "W", "bar"],
    "anomaly-repeated": ["Leituras repetidas", "Sequências de pelo menos quatro leituras elétricas idênticas.", "leituras", "bar"],
    "anomaly-inconsistency": ["Inconsistências elétricas", "Diferença entre potência medida e tensão × corrente acima de 30%.", "W", "bar"],
    "availability-history": ["Histórico de comunicação", "Medições recebidas por dia e equipamento.", "medições", "line"],
    "availability-percent": ["Disponibilidade estimada", "Estimativa baseada em medições esperadas a cada 5 segundos.", "%", "bar"],
    "availability-gaps": ["Intervalos sem medições", "Duração dos intervalos acima de 10 segundos.", "segundos", "bar"],
    "availability-interruptions": ["Quantidade de interrupções", "Intervalos maiores que duas janelas esperadas.", "interrupções", "bar"],
    "availability-longest-gap": ["Maior intervalo sem comunicação", "Maior intervalo entre medições consecutivas.", "segundos", "bar"]
};

module.exports = { categories, allGraphIds, graphMeta };
