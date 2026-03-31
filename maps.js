// ================================
// maps.js — Stage Definitions
// ================================

const MAPS = [
  {
    id: 'timestrike',
    name: 'TimeStrike Arena',
    emoji: '⚔️',
    bgTop: '#0d0d1f',
    bgBottom: '#141430',
    bgTopStop: '#0d0820',
    bgBottomStop: '#1a0830',
    gridColor: 'rgba(255,255,255,0.03)',
    platformColor0: '#2a2a45',
    platformColor1: '#1a1a30',
    platformHighlight: 'rgba(100,100,200,0.4)',
    platformStroke: 'rgba(80,80,160,0.3)',
    buildPlatforms(W, H) {
      return [
        { x: 0,        y: H - 40,  w: W,        h: 40 },
        { x: W*0.05,   y: H - 180, w: W*0.18,   h: 18 },
        { x: W*0.77,   y: H - 180, w: W*0.18,   h: 18 },
        { x: W*0.35,   y: H - 280, w: W*0.30,   h: 18 },
        { x: W*0.10,   y: H - 380, w: W*0.14,   h: 18 },
        { x: W*0.76,   y: H - 380, w: W*0.14,   h: 18 },
      ];
    }
  },
  {
    id: 'neon_city',
    name: 'Neon City Rooftops',
    emoji: '🌆',
    bgTop: '#0a0014',
    bgBottom: '#1a0028',
    bgTopStop: '#160020',
    bgBottomStop: '#2a0040',
    gridColor: 'rgba(255,0,255,0.05)',
    platformColor0: '#1a0030',
    platformColor1: '#0d0020',
    platformHighlight: 'rgba(255,0,200,0.4)',
    platformStroke: 'rgba(200,0,255,0.4)',
    buildPlatforms(W, H) {
      return [
        { x: 0,        y: H - 40,  w: W * 0.3,  h: 40 },
        { x: W * 0.7,  y: H - 40,  w: W * 0.3,  h: 40 },
        { x: W * 0.35, y: H - 40,  w: W * 0.3,  h: 40 },
        { x: W * 0.1,  y: H - 160, w: W * 0.2,  h: 18 },
        { x: W * 0.7,  y: H - 160, w: W * 0.2,  h: 18 },
        { x: W * 0.4,  y: H - 240, w: W * 0.2,  h: 18 },
        { x: W * 0.15, y: H - 340, w: W * 0.15, h: 18 },
        { x: W * 0.7,  y: H - 340, w: W * 0.15, h: 18 },
        { x: W * 0.42, y: H - 420, w: W * 0.16, h: 18 },
      ];
    }
  },
  {
    id: 'volcanic',
    name: 'Volcanic Cavern',
    emoji: '🌋',
    bgTop: '#1a0500',
    bgBottom: '#2d0a00',
    bgTopStop: '#200800',
    bgBottomStop: '#3a1000',
    gridColor: 'rgba(255,80,0,0.06)',
    platformColor0: '#3a1500',
    platformColor1: '#250a00',
    platformHighlight: 'rgba(255,120,0,0.5)',
    platformStroke: 'rgba(255,80,0,0.4)',
    buildPlatforms(W, H) {
      return [
        { x: 0,        y: H - 40,  w: W * 0.2,  h: 40 },
        { x: W * 0.8,  y: H - 40,  w: W * 0.2,  h: 40 },
        { x: W * 0.25, y: H - 100, w: W * 0.5,  h: 18 },
        { x: W * 0.05, y: H - 200, w: W * 0.15, h: 18 },
        { x: W * 0.8,  y: H - 200, w: W * 0.15, h: 18 },
        { x: W * 0.38, y: H - 280, w: W * 0.24, h: 18 },
        { x: W * 0.12, y: H - 370, w: W * 0.18, h: 18 },
        { x: W * 0.7,  y: H - 370, w: W * 0.18, h: 18 },
      ];
    }
  },
  {
    id: 'void',
    name: 'The Void',
    emoji: '🌌',
    bgTop: '#000005',
    bgBottom: '#000010',
    bgTopStop: '#05000a',
    bgBottomStop: '#0a0015',
    gridColor: 'rgba(100,100,255,0.04)',
    platformColor0: '#0a0a20',
    platformColor1: '#050515',
    platformHighlight: 'rgba(100,50,255,0.5)',
    platformStroke: 'rgba(80,30,200,0.4)',
    buildPlatforms(W, H) {
      // Floating islands — no ground, all platforms
      return [
        { x: W*0.02,  y: H - 80,  w: W*0.22, h: 18 },
        { x: W*0.76,  y: H - 80,  w: W*0.22, h: 18 },
        { x: W*0.3,   y: H - 160, w: W*0.4,  h: 18 },
        { x: W*0.08,  y: H - 260, w: W*0.2,  h: 18 },
        { x: W*0.72,  y: H - 260, w: W*0.2,  h: 18 },
        { x: W*0.38,  y: H - 340, w: W*0.24, h: 18 },
        { x: W*0.15,  y: H - 420, w: W*0.16, h: 18 },
        { x: W*0.69,  y: H - 420, w: W*0.16, h: 18 },
        { x: W*0.4,   y: H - 490, w: W*0.2,  h: 18 },
      ];
    }
  },
  {
    id: 'temple',
    name: 'Ancient Temple',
    emoji: '🏛️',
    bgTop: '#0d1a00',
    bgBottom: '#1a2800',
    bgTopStop: '#151f00',
    bgBottomStop: '#223300',
    gridColor: 'rgba(100,200,0,0.04)',
    platformColor0: '#2a3500',
    platformColor1: '#1a2200',
    platformHighlight: 'rgba(100,200,50,0.4)',
    platformStroke: 'rgba(80,160,30,0.35)',
    buildPlatforms(W, H) {
      return [
        { x: 0,        y: H - 40,  w: W,        h: 40 },
        { x: W*0.1,    y: H - 140, w: W*0.12,   h: 18 },
        { x: W*0.78,   y: H - 140, w: W*0.12,   h: 18 },
        { x: W*0.32,   y: H - 200, w: W*0.12,   h: 18 },
        { x: W*0.56,   y: H - 200, w: W*0.12,   h: 18 },
        { x: W*0.42,   y: H - 300, w: W*0.16,   h: 18 },
        { x: W*0.05,   y: H - 320, w: W*0.14,   h: 18 },
        { x: W*0.81,   y: H - 320, w: W*0.14,   h: 18 },
        { x: W*0.38,   y: H - 410, w: W*0.24,   h: 18 },
      ];
    }
  },
  {
    id: 'ice_peak',
    name: 'Ice Peak',
    emoji: '❄️',
    bgTop: '#001530',
    bgBottom: '#002040',
    bgTopStop: '#001a38',
    bgBottomStop: '#003050',
    gridColor: 'rgba(150,220,255,0.05)',
    platformColor0: '#003050',
    platformColor1: '#001e35',
    platformHighlight: 'rgba(150,220,255,0.5)',
    platformStroke: 'rgba(100,180,220,0.4)',
    buildPlatforms(W, H) {
      return [
        { x: 0,        y: H - 40,  w: W,        h: 40 },
        { x: W*0.06,   y: H - 170, w: W*0.22,   h: 18 },
        { x: W*0.72,   y: H - 170, w: W*0.22,   h: 18 },
        { x: W*0.28,   y: H - 250, w: W*0.14,   h: 18 },
        { x: W*0.58,   y: H - 250, w: W*0.14,   h: 18 },
        { x: W*0.42,   y: H - 320, w: W*0.16,   h: 18 },
        { x: W*0.1,    y: H - 390, w: W*0.16,   h: 18 },
        { x: W*0.74,   y: H - 390, w: W*0.16,   h: 18 },
      ];
    }
  },
];
