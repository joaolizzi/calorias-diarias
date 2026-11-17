// Catálogo completo de exercícios de academia em português.
// Baseado na base aberta do wger (wger.de), traduzido e sem duplicatas;
// alongamentos, mobilidade e exercícios de reabilitação ficaram de fora.
// Formato: 'Nome|código do equipamento' agrupado por músculo.

const EQUIPMENT = {
  B: 'Barra', W: 'Barra W', H: 'Halteres', M: 'Máquina', P: 'Polia', S: 'Smith', K: 'Kettlebell',
  C: 'Peso corporal', E: 'Elástico', T: 'TRX', A: 'Anilha', L: 'Landmine', F: 'Barra fixa',
  G: 'Paralelas', O: 'Medicine ball', R: 'Roda abdominal', X: 'Aparelho de cardio', D: 'Diversos',
};

const GROUPS = {
  Peito: [
    'Supino reto com barra|B', 'Supino reto com halteres|H', 'Supino inclinado com barra|B', 'Supino inclinado com halteres|H',
    'Supino declinado com barra|B', 'Supino declinado com halteres|H', 'Supino declinado máquina|M', 'Supino reto no Smith|S',
    'Supino inclinado no Smith|S', 'Supino sentado máquina|M', 'Supino articulado|M', 'Supino com pausa|B', 'Supino pegada invertida|B',
    'Supino pegada invertida com halteres|H', 'Supino no chão com halteres|H', 'Supino Larsen|B', 'Supino Hex com halteres|H',
    'Supino com halteres pegada neutra|H', 'Supino reto na polia|P', 'Supino inclinado na polia|P', 'Supino declinado na polia|P',
    'Crucifixo reto com halteres|H', 'Crucifixo inclinado com halteres|H', 'Crucifixo declinado com halteres|H',
    'Crossover polia alta|P', 'Crossover polia média|P', 'Crossover polia baixa|P', 'Crucifixo na polia sentado|P',
    'Press around na polia|P', 'Pullover com halter|H', 'Flexão de braço|C', 'Flexão inclinada|C', 'Flexão declinada|C',
    'Flexão com peso|A', 'Flexão com palmas|C', 'Flexão com joelhos apoiados|C', 'Flexão hindu|C', 'Flexão com halteres|H',
    'Flexão nas paralelas baixas|C', 'Paralelas para peito|G', 'Mergulho nas argolas|D',
  ],
  Costas: [
    'Puxada aberta|P', 'Puxada fechada|P', 'Puxada supinada|P', 'Puxada com triângulo|P', 'Puxada pegada neutra|P',
    'Puxada unilateral|P', 'Puxada unilateral cruzada|P', 'Puxada unilateral ajoelhado|P', 'Puxada articulada|M',
    'Pulldown braços estendidos com barra|P', 'Pulldown braços estendidos com corda|P', 'Pullover na polia alta|P',
    'Barra fixa pronada|F', 'Barra fixa aberta|F', 'Barra fixa supinada|F', 'Barra fixa pegada neutra|F', 'Barra fixa arqueiro|F',
    'Barra fixa isométrica|F', 'Barra fixa com peso|F', 'Barra fixa assistida|M', 'Remada australiana|C',
    'Remada curvada pronada|B', 'Remada curvada supinada|B', 'Remada Pendlay|B', 'Remada curvada com halteres|H',
    'Remada unilateral com halter (serrote)|H', 'Remada Kroc|H', 'Remada Meadows|L', 'Remada landmine unilateral|L',
    'Remada cavalinho|B', 'Remada baixa na polia|P', 'Remada baixa com triângulo|P', 'Remada baixa pegada aberta|P',
    'Remada unilateral na polia|P', 'Remada máquina pegada fechada|M', 'Remada máquina supinada|M', 'Remada articulada|M',
    'Remada apoiada no banco inclinado|H', 'Remada Helms|H', 'Remada renegada|H', 'Remada deitada no banco (seal row)|B',
    'Remada no TRX|T', 'Remada gorila com kettlebell|K', 'Levantamento terra|B', 'Levantamento terra com déficit|B',
    'Levantamento terra sumô|B', 'Levantamento terra com halteres|H', 'Levantamento terra com kettlebell|K', 'Rack pull|B',
  ],
  Lombar: [
    'Hiperextensão lombar (banco romano)|M', 'Hiperextensão reversa|M', 'Superman|C', 'Perdigueiro (bird dog)|C',
  ],
  Trapézio: [
    'Encolhimento com barra|B', 'Encolhimento com halteres|H', 'Encolhimento no Smith|S', 'Encolhimento na polia|P',
    'Encolhimento máquina|M', 'Elevação Y para trapézio inferior|H',
  ],
  Ombros: [
    'Desenvolvimento com halteres|H', 'Desenvolvimento militar com barra|B', 'Desenvolvimento no Smith|S', 'Desenvolvimento Arnold|H',
    'Desenvolvimento com barra W|W', 'Desenvolvimento landmine|L', 'Push press|B', 'Elevação lateral com halteres|H',
    'Elevação lateral sentado|H', 'Elevação lateral inclinada|H', 'Elevação lateral unilateral na polia|P',
    'Elevação lateral na polia por trás do corpo|P', 'Elevação em Y na polia|P', 'Elevação frontal com halteres|H',
    'Elevação frontal com anilha|A', 'Elevação frontal na polia|P', 'Elevação frontal com barra|B', 'Elevação Y no banco inclinado|H',
    'Elevação Y-T-W|H', 'Crucifixo inverso com halteres|H', 'Crucifixo inverso no banco inclinado|H', 'Crucifixo inverso na polia|P',
    'Face pull|P', 'Remada alta com halteres|H', 'Remada alta com barra W|W', 'Remada alta no Smith|S', 'Remada alta na polia|P',
    'Rotação externa na polia|P', 'Rotação interna na polia|P', 'Rotação externa com halter|H', 'Pull-apart com elástico|E',
    'Flexão pike|C', 'Flexão em parada de mão|C',
  ],
  Bíceps: [
    'Rosca direta com barra|B', 'Rosca direta com barra W|W', 'Rosca alternada com halteres|H', 'Rosca simultânea com halteres|H',
    'Rosca sentado com halteres|H', 'Rosca aberta com halteres|H', 'Rosca martelo|H', 'Rosca martelo alternada|H',
    'Rosca martelo cruzada|H', 'Rosca martelo na polia com corda|P', 'Rosca concentrada|H', 'Rosca concentrada na polia|P',
    'Rosca Scott com barra W|W', 'Rosca Scott unilateral com halter|H', 'Rosca Scott inversa|W', 'Rosca inclinada com halteres|H',
    'Rosca aranha|H', 'Rosca na polia com barra reta|P', 'Rosca bayesiana na polia|P', 'Rosca inversa com barra|B',
    'Rosca inversa na polia|P', 'Rosca Zottman|H', 'Rosca arrastada|H', 'Rosca 21|B', 'Rosca com kettlebell|K', 'Rosca no TRX|T',
  ],
  Tríceps: [
    'Tríceps na polia com barra V|P', 'Tríceps unilateral na polia|P', 'Tríceps francês com halter|H', 'Tríceps francês na polia|P',
    'Tríceps francês unilateral na polia|P', 'Tríceps testa com barra W|W', 'Tríceps testa com barra|B', 'Tríceps testa com halteres|H',
    'Tríceps testa no banco inclinado|W', 'Tríceps coice com halter|H', 'Tríceps coice na polia|P', 'Tríceps cruzado na polia alta|P',
    'Supino fechado|B', 'Supino fechado no Smith|S', 'Supino fechado com halteres|H', 'Paralelas|G', 'Paralelas assistidas|M',
    'Mergulho no banco|C', 'JM press|B', 'Tate press|H', 'Flexão diamante|C', 'Tríceps no TRX|T',
  ],
  Antebraço: [
    'Rosca de punho com barra|B', 'Rosca de punho inversa com barra|B', 'Rosca de punho com halteres|H', 'Extensão de punho com halter|H',
    'Rosca de punho na polia|P', 'Rolo de punho|D', 'Hand grip|D', 'Pinça de anilhas|A', 'Suspensão na barra|F',
  ],
  Quadríceps: [
    'Agachamento livre com barra|B', 'Agachamento frontal|B', 'Agachamento no Smith|S', 'Agachamento hack com barra|B',
    'Agachamento pêndulo|M', 'Agachamento com cinto (belt squat)|M', 'Agachamento goblet|H', 'Agachamento frontal com halteres|H',
    'Agachamento frontal com kettlebells|K', 'Agachamento na caixa|B', 'Agachamento overhead|B', 'Agachamento com trap bar|B',
    'Agachamento livre|C', 'Agachamento com salto|C', 'Agachamento isométrico na parede|C', 'Agachamento pistol|C',
    'Agachamento búlgaro com halteres|H', 'Agachamento búlgaro no Smith|S', 'Afundo com halteres|H', 'Afundo no Smith|S',
    'Avanço com barra|B', 'Avanço com halteres|H', 'Passada com halteres|H', 'Passada com barra|B', 'Afundo reverso|H',
    'Afundo reverso com barra|B', 'Afundo lateral|C', 'Agachamento cossaco|C', 'Leg press pés juntos|M', 'Leg press pés afastados|M',
    'Leg press horizontal|M', 'Cadeira extensora unilateral|M', 'Subida no banco (step-up)|H',
  ],
  Posterior: [
    'Flexora em pé|M', 'Stiff com barra|B', 'Stiff com halteres|H', 'Stiff unilateral|H', 'Levantamento terra romeno|B',
    'Levantamento terra romeno com halteres|H', 'Levantamento terra unilateral com kettlebell|K', 'Bom dia (good morning)|B',
    'Flexão nórdica|C', 'Flexora com elástico|E', 'Flexora deslizante no chão|C',
  ],
  Glúteos: [
    'Hip thrust com barra|B', 'Hip thrust com halter|H', 'Hip thrust no Smith|S', 'Hip thrust unilateral|C', 'Elevação pélvica|C',
    'Elevação pélvica unilateral|C', 'Glute drive|M', 'Coice na máquina|M', 'Coice na polia|P', 'Coice com elástico|E',
    'Coice no solo (quatro apoios)|C', 'Abdução de quadril na polia|P', 'Abdução de quadril deitado de lado|C',
    'Ostra com elástico|E', 'Caminhada lateral com elástico|E', 'Pull through na polia|P', 'Agachamento sumô|H',
  ],
  Adutores: [
    'Adução de quadril na polia|P', 'Adução Copenhagen|C',
  ],
  Panturrilhas: [
    'Panturrilha em pé|M', 'Panturrilha sentado|M', 'Panturrilha no leg press|M', 'Panturrilha no hack|M', 'Panturrilha no Smith|S',
    'Panturrilha unilateral|C', 'Panturrilha sentado com halter|H', 'Elevação de tibial|C',
  ],
  Abdômen: [
    'Abdominal reto|C', 'Abdominal com peso|A', 'Abdominal infra|C', 'Abdominal bicicleta|C', 'Abdominal declinado|D',
    'Abdominal com pernas elevadas|C', 'Abdominal na bola suíça|D', 'Abdominal borboleta|C', 'Sit-up|C', 'Abdominal oblíquo|C',
    'Abdominal oblíquo em pé|C', 'Elevação de pernas deitado|C', 'Elevação de pernas na barra fixa|F', 'Elevação de joelhos na barra fixa|F',
    'Elevação de pernas no banco declinado|D', 'Elevação de pernas na cadeira romana|M', 'Toes to bar|F', 'Prancha|C',
    'Prancha lateral|C', 'Prancha alta|C', 'Prancha com toque no ombro|C', 'Prancha com elevação de perna|C', 'Roda abdominal|R',
    'Rollout com barra|B', 'Rollout no TRX|T', 'Dead bug|C', 'Hollow hold|C', 'L-sit|G', 'Russian twist|A',
    'Rotação com medicine ball|O', 'Lenhador na polia|P', 'Lenhador reverso na polia|P', 'Pallof press|P',
    'Rotação de tronco na polia|P', 'Rotação de tronco máquina|M', 'Flexão lateral com halter|H', 'Flexão lateral máquina|M',
    'Limpador de para-brisa|F', 'Tesoura (flutter kicks)|C', 'Toque no calcanhar|C', 'Escalador (mountain climber)|C', 'Dragon flag|C',
  ],
  'Corpo inteiro': [
    'Burpee|C', 'Burpee sem flexão|C', 'Kettlebell swing|K', 'Power clean|B', 'Clean com halteres|H', 'Clean and press|B',
    'Clean and press com kettlebells|K', 'Arremesso (clean and jerk)|B', 'Arranco (snatch)|B', 'Thruster com barra|B',
    'Thruster com halteres|H', 'Devil press|H', 'Turkish get-up|K', 'Wall ball|O', 'Ball slam|O', 'Corda naval|D', 'Empurrar trenó|D',
    'Caminhada do fazendeiro|H', 'Carregamento unilateral (suitcase carry)|H', 'Polichinelo|C', 'Pular corda|D', 'Salto na caixa|C',
    'Skipping|C', 'Saco de pancada|D',
  ],
  Cardio: [
    'Corrida na esteira|X', 'Caminhada na esteira|X', 'Corrida intervalada|X', 'Bicicleta ergométrica|X', 'Bicicleta horizontal|X',
    'Spinning|X', 'Elíptico (transport)|X', 'Remo ergômetro|X', 'Simulador de escada|X', 'Ski erg|X', 'Escalador vertical|X',
    'Natação|D', 'Corrida ao ar livre|D', 'Caminhada|D',
  ],
};

const slug = (value) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const EXERCISE_CATALOG = Object.entries(GROUPS).flatMap(([muscle, items]) => items.map((item) => {
  const [name, code] = item.split('|');
  return { id: slug(name), name, muscle, equipment: EQUIPMENT[code] || EQUIPMENT.D };
}));
