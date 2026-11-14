/**
 * Reusable Circuit Snippets / Sub-Circuits Library
 * Ready-to-insert modular hardware blocks
 */

export const CIRCUIT_SNIPPETS = [
  {
    id: 'i2c-pullup',
    name: 'I2C Bus Pull-Up Network',
    category: 'Communication',
    icon: '⚡',
    desc: 'Sepasang resistor pull-up 4.7kΩ untuk jalur SDA dan SCL ke VCC 3.3V/5V guna memastikan stabilitas transmisi bus.',
    components: [
      {
        id: 'resistor',
        name: 'Resistor Pull-Up SCL',
        theme: 'passive',
        width: 90,
        height: 70,
        props: { value: '4.7kΩ' },
        dx: 0,
        dy: 0,
        pins: [
          { id: '1', label: '1 (VCC)', side: 'left', pos: 0.5, type: 'passive' },
          { id: '2', label: '2 (SCL)', side: 'right', pos: 0.5, type: 'passive' }
        ]
      },
      {
        id: 'resistor',
        name: 'Resistor Pull-Up SDA',
        theme: 'passive',
        width: 90,
        height: 70,
        props: { value: '4.7kΩ' },
        dx: 0,
        dy: 100,
        pins: [
          { id: '1', label: '1 (VCC)', side: 'left', pos: 0.5, type: 'passive' },
          { id: '2', label: '2 (SDA)', side: 'right', pos: 0.5, type: 'passive' }
        ]
      }
    ],
    wires: [
      { fromIdx: 0, fromPin: '1', toIdx: 1, toPin: '1', color: '#ef4444', label: 'VCC' }
    ]
  },
  {
    id: 'analog-potentiometer',
    name: 'Analog Input Potentiometer 10k',
    category: 'Sensors & Inputs',
    icon: '🎛️',
    desc: 'Potensiometer putar 10kΩ sebagai pembagi tegangan analog input untuk pin ADC mikrokontroler.',
    components: [
      {
        id: 'potentiometer',
        name: 'Potentiometer 10k',
        theme: 'passive',
        width: 110,
        height: 95,
        props: { value: '10kΩ' },
        dx: 0,
        dy: 0,
        pins: [
          { id: 'VCC', label: 'VCC (1)', side: 'left', pos: 0.28, type: 'power' },
          { id: 'SIG', label: 'WIPER (2)', side: 'right', pos: 0.5, type: 'analog' },
          { id: 'GND', label: 'GND (3)', side: 'left', pos: 0.72, type: 'gnd' }
        ]
      },
      {
        id: 'capacitor',
        name: 'Noise Filter 100nF',
        theme: 'passive',
        width: 90,
        height: 70,
        props: { value: '100nF' },
        dx: 160,
        dy: 30,
        pins: [
          { id: '+', label: '+', side: 'left', pos: 0.5, type: 'passive' },
          { id: '-', label: '−', side: 'right', pos: 0.5, type: 'passive' }
        ]
      }
    ],
    wires: [
      { fromIdx: 0, fromPin: 'SIG', toIdx: 1, toPin: '+', color: '#38bdf8', label: 'ADC_Filtered' }
    ]
  },
  {
    id: 'servo-output-block',
    name: 'SG90 Micro Servo + Decoupling Cap',
    category: 'Actuators',
    icon: '🦾',
    desc: 'Aktuator Servo SG90 9g lengkap dengan kapasitor buffer peredam lonjakan arus motor.',
    components: [
      {
        id: 'servo-sg90',
        name: 'Micro Servo SG90',
        theme: 'output',
        width: 130,
        height: 105,
        dx: 0,
        dy: 0,
        pins: [
          { id: 'PWM', label: 'PWM (Sig)', side: 'left', pos: 0.28, type: 'digital' },
          { id: 'VCC', label: 'VCC (+5V)', side: 'left', pos: 0.5, type: 'power' },
          { id: 'GND', label: 'GND (Gnd)', side: 'left', pos: 0.72, type: 'gnd' }
        ]
      },
      {
        id: 'capacitor',
        name: 'Decoupling 100µF',
        theme: 'passive',
        width: 90,
        height: 70,
        props: { value: '100µF' },
        dx: 170,
        dy: 20,
        pins: [
          { id: '+', label: '+', side: 'left', pos: 0.5, type: 'passive' },
          { id: '-', label: '−', side: 'right', pos: 0.5, type: 'passive' }
        ]
      }
    ],
    wires: [
      { fromIdx: 0, fromPin: 'VCC', toIdx: 1, toPin: '+', color: '#ef4444', label: '5V' },
      { fromIdx: 0, fromPin: 'GND', toIdx: 1, toPin: '-', color: '#64748b', label: 'GND' }
    ]
  },
  {
    id: 'relay-protection',
    name: '5V Relay + Flyback Diode 1N4007',
    category: 'Switching & Power',
    icon: '🔌',
    desc: 'Modul relai terproteksi dioda snubber 1N4007 untuk menyerap lonjakan ggl induktif coil.',
    components: [
      {
        id: 'relay',
        name: '5V Relay Module',
        theme: 'switch',
        width: 130,
        height: 120,
        dx: 0,
        dy: 0,
        pins: [
          { id: 'VCC', label: 'VCC', side: 'top', pos: 0.25, type: 'power' },
          { id: 'GND', label: 'GND', side: 'top', pos: 0.5, type: 'gnd' },
          { id: 'IN', label: 'IN', side: 'top', pos: 0.75, type: 'digital' },
          { id: 'COM', label: 'COM', side: 'bottom', pos: 0.3, type: 'passive' },
          { id: 'NO', label: 'NO', side: 'bottom', pos: 0.55, type: 'passive' },
          { id: 'NC', label: 'NC', side: 'bottom', pos: 0.8, type: 'passive' }
        ]
      },
      {
        id: 'diode-1n4007',
        name: '1N4007 Flyback',
        theme: 'passive',
        width: 100,
        height: 70,
        dx: 170,
        dy: -20,
        pins: [
          { id: 'A', label: 'A (Anode)', side: 'left', pos: 0.5, type: 'passive' },
          { id: 'K', label: 'K (Cathode)', side: 'right', pos: 0.5, type: 'passive' }
        ]
      }
    ],
    wires: [
      { fromIdx: 0, fromPin: 'GND', toIdx: 1, toPin: 'A', color: '#64748b', label: 'GND' },
      { fromIdx: 0, fromPin: 'VCC', toIdx: 1, toPin: 'K', color: '#ef4444', label: 'VCC' }
    ]
  }
]
