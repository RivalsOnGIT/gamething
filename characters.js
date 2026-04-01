// ================================
// characters.js — Character Roster
// ================================

const CHARACTERS = [
  {
    id: 'chronomancer', name: 'Chronomancer', title: 'Master of Time',
    color: '#00d4ff', accentColor: '#7b2fff', emoji: '🧙',
    description: 'Freezes all enemies in time.',
    stats: { hp: 100, speed: 420, jumpStrength: -620, attackDamage: 12, attackCooldownMax: 1.0, abilityCooldownMax: 10 },
    ability: 'timestop', abilityLabel: 'TIME STOP', shape: 'mage',
  },
  {
    id: 'dasher', name: 'Dasher', title: 'The Blur',
    color: '#ff4d4d', accentColor: '#ff8800', emoji: '⚡',
    description: 'Blazing dash that deals damage.',
    stats: { hp: 90, speed: 480, jumpStrength: -640, attackDamage: 10, attackCooldownMax: 0.8, abilityCooldownMax: 5 },
    ability: 'dash', abilityLabel: 'DASH STRIKE', shape: 'speedster',
  },
  {
    id: 'titan', name: 'Titan', title: 'The Unmovable',
    color: '#f5a623', accentColor: '#8b4513', emoji: '🪨',
    description: 'Heavy & hard-hitting. Shockwave.',
    stats: { hp: 150, speed: 280, jumpStrength: -500, attackDamage: 20, attackCooldownMax: 1.5, abilityCooldownMax: 8 },
    ability: 'shockwave', abilityLabel: 'SHOCKWAVE', shape: 'tank',
  },
  {
    id: 'phantom', name: 'Phantom', title: 'The Unseen',
    color: '#b39ddb', accentColor: '#4a0080', emoji: '👻',
    description: 'Turns invisible for 2 seconds.',
    stats: { hp: 80, speed: 460, jumpStrength: -660, attackDamage: 14, attackCooldownMax: 0.9, abilityCooldownMax: 7 },
    ability: 'invisibility', abilityLabel: 'VANISH', shape: 'ghost',
  },
  {
    id: 'pyro', name: 'Pyro', title: 'The Inferno',
    color: '#ff6b35', accentColor: '#ffcc00', emoji: '🔥',
    description: 'Burns enemies for 3s DoT.',
    stats: { hp: 95, speed: 400, jumpStrength: -610, attackDamage: 11, attackCooldownMax: 0.9, abilityCooldownMax: 6 },
    ability: 'burn', abilityLabel: 'IGNITE', shape: 'pyro',
  },
  {
    id: 'techno', name: 'Techno', title: 'The Engineer',
    color: '#00e676', accentColor: '#004d40', emoji: '🤖',
    description: 'Deploys a turret that auto-attacks.',
    stats: { hp: 100, speed: 390, jumpStrength: -600, attackDamage: 10, attackCooldownMax: 1.0, abilityCooldownMax: 12 },
    ability: 'turret', abilityLabel: 'DEPLOY TURRET', shape: 'robot',
  },
  {
    id: 'glacius', name: 'Glacius', title: 'The Frozen One',
    color: '#a0e8ff', accentColor: '#005f8a', emoji: '❄️',
    description: 'Slows enemies; Ice Spike projectile.',
    stats: { hp: 110, speed: 350, jumpStrength: -590, attackDamage: 13, attackCooldownMax: 1.1, abilityCooldownMax: 9 },
    ability: 'freeze', abilityLabel: 'ICE SPIKE', shape: 'ice',
  },
  {
    id: 'brawler', name: 'Brawler', title: 'The Fist',
    color: '#e8b86d', accentColor: '#7a3b00', emoji: '🥊',
    description: 'Wide attack, massive knockback. Uppercut launches foes.',
    stats: { hp: 120, speed: 360, jumpStrength: -580, attackDamage: 18, attackCooldownMax: 1.3, abilityCooldownMax: 7 },
    ability: 'uppercut', abilityLabel: 'UPPERCUT', shape: 'brawler',
  },
  {
    id: 'wraith', name: 'Wraith', title: 'The Shadow',
    color: '#9e9e9e', accentColor: '#212121', emoji: '🌑',
    description: 'Teleports behind nearest target.',
    stats: { hp: 85, speed: 440, jumpStrength: -650, attackDamage: 15, attackCooldownMax: 0.85, abilityCooldownMax: 8 },
    ability: 'teleport', abilityLabel: 'SHADOW STEP', shape: 'wraith',
  },
  {
    id: 'stormbolt', name: 'Stormbolt', title: 'The Thunder',
    color: '#ffe600', accentColor: '#1a3aff', emoji: '⚡',
    description: 'Lightning strike stuns enemies 1s.',
    stats: { hp: 92, speed: 430, jumpStrength: -630, attackDamage: 11, attackCooldownMax: 0.95, abilityCooldownMax: 7 },
    ability: 'lightning', abilityLabel: 'THUNDER STRIKE', shape: 'storm',
  },
];

const STORY_NPCS = [
  { charId: 'dasher',       name: 'The Rookie',    hpMult: 0.6, speedMult: 0.8, damageMult: 0.6, aiLevel: 1 },
  { charId: 'brawler',      name: 'Knuckles',       hpMult: 0.8, speedMult: 0.9, damageMult: 0.8, aiLevel: 2 },
  { charId: 'pyro',         name: 'Ember',          hpMult: 0.9, speedMult: 1.0, damageMult: 0.9, aiLevel: 2 },
  { charId: 'phantom',      name: 'Shade',          hpMult: 1.0, speedMult: 1.1, damageMult: 1.0, aiLevel: 3 },
  { charId: 'glacius',      name: 'Frostbite',      hpMult: 1.1, speedMult: 1.0, damageMult: 1.1, aiLevel: 3 },
  { charId: 'techno',       name: 'Unit-9',         hpMult: 1.1, speedMult: 1.0, damageMult: 1.2, aiLevel: 4 },
  { charId: 'wraith',       name: 'The Shadow',     hpMult: 1.3, speedMult: 1.2, damageMult: 1.1, aiLevel: 4 },
  { charId: 'stormbolt',    name: 'Volthorn',       hpMult: 1.4, speedMult: 1.1, damageMult: 1.3, aiLevel: 5 },
  { charId: 'titan',        name: 'The Colossus',   hpMult: 1.6, speedMult: 1.0, damageMult: 1.4, aiLevel: 5 },
  { charId: 'chronomancer', name: '⚠ CHRONOLORD',   hpMult: 3.0, speedMult: 1.3, damageMult: 2.0, aiLevel: 6, isBoss: true },
];
