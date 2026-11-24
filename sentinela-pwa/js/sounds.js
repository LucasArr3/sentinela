// Catálogo dos sons de alarme (arquivos em /sounds, gerados por tools/gen_sounds.py).
export const SOUND_LIST = [
  { id: 'sirene_lamento', label: 'Sirene — lamento', cat: 'Tático', desc: 'Sobe e desce, a clássica de viatura' },
  { id: 'sirene_rapida', label: 'Sirene — rápida', cat: 'Tático', desc: 'Varredura curta e muito urgente' },
  { id: 'sirene_europeia', label: 'Sirene — alto e baixo', cat: 'Tático', desc: 'Duas notas alternadas' },
  { id: 'alerta_aereo', label: 'Alerta aéreo', cat: 'Tático', desc: 'Longa, grave e crescente' },
  { id: 'klaxon', label: 'Klaxon de emergência', cat: 'Tático', desc: 'Pulsos graves e ásperos' },
  { id: 'alarme_tatico', label: 'Alarme tático', cat: 'Tático', desc: 'Três pulsos fortes, pausa, repete' },
  { id: 'buzina_naval', label: 'Buzina naval', cat: 'Tático', desc: 'Grave e imponente' },
  { id: 'clarim', label: 'Clarim (Alvorada)', cat: 'Tático', desc: 'Toque de clarim' },
  { id: 'radio', label: 'Rádio HT', cat: 'Tático', desc: 'Chiado e tons de chamada' },
  { id: 'sonar', label: 'Sonar', cat: 'Discreto', desc: 'Ping com eco' },
  { id: 'bipes_digitais', label: 'Bipes digitais', cat: 'Discreto', desc: 'Três bipes curtos' },
  { id: 'despertador', label: 'Despertador clássico', cat: 'Clássico', desc: 'Sino duplo "trrring"' },
  { id: 'carrilhao', label: 'Carrilhão suave', cat: 'Clássico', desc: 'Sinos em arpejo, para acordar sem susto' },
];
export const SOUND_CATS = ['Tático', 'Discreto', 'Clássico'];
export const DEFAULT_SOUND = 'sirene_lamento';
export const DEFAULT_ALVORADA_SOUND = 'clarim';
// Ids antigos (versão anterior, sons sintetizados no navegador) -> novos
export const SOUND_MIGRATE = { sirene: 'sirene_lamento', sonar: 'sonar', radio: 'radio', alerta: 'bipes_digitais', buzina: 'buzina_naval', alvorada: 'clarim' };
export const migrateSound = (id) => SOUND_MIGRATE[id] || id;
export const soundUrl = (id) => `sounds/${id}.wav`;
export const soundLabel = (id, custom = []) => (SOUND_LIST.find((s) => s.id === id) || custom.find((s) => s.id === id) || { label: 'Sirene — lamento' }).label;
export const isBuiltin = (id) => SOUND_LIST.some((s) => s.id === id);
