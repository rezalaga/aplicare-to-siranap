'use strict';

const KELAS_MAP = {
  'KL1': { id_tt: '3', nama: 'Kelas 1', kode_kemkes: '0003' },
  'KL2': { id_tt: '4', nama: 'Kelas 2', kode_kemkes: '0004' },
  'KL3': { id_tt: '5', nama: 'Kelas 3', kode_kemkes: '0005' },
  'VIP': { id_tt: '2', nama: 'VIP', kode_kemkes: '0002' },
  'VVIP': { id_tt: '1', nama: 'VVIP', kode_kemkes: '0001' },
  'ICU': { id_tt: '6', nama: 'ICU', kode_kemkes: '0006' },
  'HCU': { id_tt: '7', nama: 'HCU', kode_kemkes: '0007' },
  'ICC': { id_tt: '8', nama: 'ICCU', kode_kemkes: '0008' },
  'NIC': { id_tt: '10', nama: 'NICU', kode_kemkes: '0010' },
  'PIC': { id_tt: '11', nama: 'PICU', kode_kemkes: '0011' },
  'ISO': { id_tt: '12', nama: 'Isolasi', kode_kemkes: '0012' },
};

function getMapping(kodeKelas, namaKelas) {
  if (KELAS_MAP[kodeKelas]) return KELAS_MAP[kodeKelas];
  return KELAS_MAP['KL3'];
}

module.exports = { KELAS_MAP, getMapping };
