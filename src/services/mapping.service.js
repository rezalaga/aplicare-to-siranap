'use strict';

const KELAS_MAP = {
  '1': { id_tt: '3', nama: 'Kelas 1', kode_kemkes: '0003' },
  '2': { id_tt: '4', nama: 'Kelas 2', kode_kemkes: '0004' },
  '3': { id_tt: '5', nama: 'Kelas 3', kode_kemkes: '0005' },
  '4': { id_tt: '6', nama: 'ICU', kode_kemkes: '0008' },
  '5': { id_tt: '2', nama: 'VIP', kode_kemkes: '0002' },
};

const KELAS_NAMA_ALIAS = {
  'kelas i': '1', 'kelas 1': '1', 'kelas satu': '1',
  'kelas ii': '2', 'kelas 2': '2', 'kelas dua': '2',
  'kelas iii': '3', 'kelas 3': '3', 'kelas tiga': '3',
  'icu': '4', 'picu': '4', 'nicu': '4',
  'vip': '5', 'vvip': '5',
};

function getMapping(kodeKelas, namaKelas) {
  if (KELAS_MAP[kodeKelas]) return KELAS_MAP[kodeKelas];

  const aliasKey = (namaKelas || '').toLowerCase().trim();
  const resolvedKode = KELAS_NAMA_ALIAS[aliasKey];
  if (resolvedKode && KELAS_MAP[resolvedKode]) return KELAS_MAP[resolvedKode];

  return KELAS_MAP['3'];
}

module.exports = { KELAS_MAP, KELAS_NAMA_ALIAS, getMapping };
