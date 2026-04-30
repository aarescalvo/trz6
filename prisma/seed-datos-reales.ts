/**
 * SEED - DATOS REALES SOLEMAR ALIMENTARIA S.A.
 * 
 * Este script:
 * 1. Carga los clientes reales del Excel CUIT DE USUARIOS + DATOS.xlsx
 * 2. Carga las tablas de códigos EAN-128
 * 3. Carga los artículos/productos
 * 
 * Usa UPSERT para evitar duplicados
 */

import { PrismaClient, Especie } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== DATOS REALES ====================

// Clientes del Excel CUIT DE USUARIOS + DATOS.xlsx
const CLIENTES_REALES = [
  { nombre: 'DOS DE FIERRO SA', cuit: '30715475533', email: 'carnicerias.la.criolla@gmail.com', telefono: '2994 02-2200', esProductor: false, esUsuarioFaena: true },
  { nombre: 'FERREYRA MARTIN RUBEN', cuit: '23335321359', email: 'martin_ferreyra_797@hotmail.com', telefono: '2984 50-7605', esProductor: true, esUsuarioFaena: true },
  { nombre: 'MUCA SAS', cuit: '30716490323', email: 'tesoreria@muca.com.ar', telefono: '2996 37-6511', esProductor: false, esUsuarioFaena: true },
  { nombre: 'FERREYRA RUBEN ALBERTO', cuit: '20136718216', email: null, telefono: '2984 50-0770', esProductor: true, esUsuarioFaena: true },
  { nombre: 'PENROZ CINDY MARIA FERNANDA', cuit: '23345458654', email: 'carneskupal@gmail.com', telefono: '2996 25-5126', esProductor: false, esUsuarioFaena: true },
  { nombre: 'MORAGA MAXIMILIANO IVAN', cuit: '20396498627', email: 'Valentinmoraga04@gmail.com', telefono: '2984 21-8759', esProductor: false, esUsuarioFaena: true },
  { nombre: 'FRIGORIFICO DE LA PATAGONIA SRL', cuit: '30718653467', email: 'ganadospatagonicos@gmail.com', telefono: '2995 56-7306', esProductor: true, esUsuarioFaena: true },
  { nombre: 'GANADERA NORTE NEUQUINO SAS', cuit: '30716426757', email: 'adminsr@srfrigorifico.com.ar', telefono: '2994 01-8943', esProductor: false, esUsuarioFaena: true },
  { nombre: 'BOSQUE AMADO S.R.L', cuit: '30707770690', email: 'Bosqueamadosrl@gmail.com', telefono: '2996 72-8854', esProductor: true, esUsuarioFaena: true },
  { nombre: 'DISTRIBUIDORA DE LA PATAGONIA SRL', cuit: '30709507849', email: 'Distribuidoradelapatagoniasrl@hotmil.com', telefono: '2942 66-4244', esProductor: false, esUsuarioFaena: true },
  { nombre: 'JORGE ALBERTO LASAGNO', cuit: '20250067861', email: null, telefono: null, esProductor: true, esUsuarioFaena: false },
  { nombre: 'MAIZALES DE LA PATAGONIA S.R.L', cuit: '30716325276', email: 'Ariel_trapial@hotmail.com', telefono: '2984 57-0584', esProductor: true, esUsuarioFaena: true },
  { nombre: 'TRIAUD SA', cuit: '30715935100', email: 'Triaudsa@gmail.com', telefono: '2302 60-2382', esProductor: false, esUsuarioFaena: true },
  { nombre: 'VIENTOS DEL VALLE SRL', cuit: '30712143483', email: 'gabriel_pagani@hotmail.com', telefono: '2995 33-1473', esProductor: false, esUsuarioFaena: true },
  { nombre: 'ROSA JOSE ANIBAL', cuit: '20246268062', email: null, telefono: '2920 66-1658', esProductor: true, esUsuarioFaena: false },
  { nombre: 'EVASIO MARMETTO SA', cuit: '30537620893', email: 'Facundo@marmetto.com.ar', telefono: '2262 58-2647', esProductor: false, esUsuarioFaena: true },
  { nombre: 'NECORUTA', cuit: '30710798946', email: null, telefono: null, esProductor: false, esUsuarioFaena: true },
  // Productores adicionales del historial
  { nombre: 'RUFFINI GABRIEL', cuit: null, email: null, telefono: null, esProductor: true, esUsuarioFaena: false },
  { nombre: 'BELLOCCHIO JUAN IGNACIO', cuit: null, email: null, telefono: null, esProductor: true, esUsuarioFaena: false },
];

// Códigos de Especie para EAN-128
const CODIGOS_ESPECIE = [
  { codigo: '0', nombre: 'Todas las especies' },
  { codigo: '1', nombre: 'Equino' },
  { codigo: '2', nombre: 'Caballo' },
  { codigo: '3', nombre: 'Potro' },
  { codigo: '4', nombre: 'Burro' },
  { codigo: '5', nombre: 'Equino LAND L' },
];

// Códigos de Transporte para EAN-128
const CODIGOS_TRANSPORTE = [
  { codigo: '0', nombre: 'No definido' },
  { codigo: '1', nombre: 'BARCO enfriado' },
  { codigo: '2', nombre: 'BARCO congelado' },
  { codigo: '3', nombre: 'BARCO salado' },
  { codigo: '4', nombre: 'AVION enfriado' },
  { codigo: '5', nombre: 'AVION congelado' },
  { codigo: '6', nombre: 'CAMION enfriado' },
  { codigo: '7', nombre: 'CAMION congelado' },
  { codigo: '8', nombre: 'INTERNO' },
];

// Códigos de Destino para EAN-128
const CODIGOS_DESTINO = [
  { codigo: '.00', nombre: 'Cualquiera' },
  { codigo: '.01', nombre: 'Italia' },
  { codigo: '.02', nombre: 'Francia' },
  { codigo: '.03', nombre: 'España' },
  { codigo: '.04', nombre: 'Bélgica' },
  { codigo: '.05', nombre: 'Rusia' },
  { codigo: '.06', nombre: 'Suiza' },
  { codigo: '.07', nombre: 'Austria' },
  { codigo: '.08', nombre: 'Japón' },
  { codigo: '.09', nombre: 'Kazajistán' },
  { codigo: '.10', nombre: 'Japón IMI' },
  { codigo: '.16', nombre: 'Mercado Interno' },
];

// Códigos de Tipo de Trabajo para EAN-128
const CODIGOS_TIPO_TRABAJO = [
  { codigo: '0', nombre: 'Ninguna' },
  { codigo: '1', nombre: 'Descarte' },
  { codigo: '2', nombre: 'T/lama' },
  { codigo: '3', nombre: 'T/MR' },
  { codigo: '4', nombre: 'T/jaslo' },
  { codigo: '5', nombre: 'T/square' },
  { codigo: '6', nombre: 'T/checo' },
];

// Códigos de Tipificación para EAN-128 (únicos por código+especie)
const CODIGOS_TIPIFICACION = [
  { codigo: '.00', nombre: 'Todas', especie: 'BOVINO' },
  { codigo: '.01', nombre: 'No tipificada', especie: 'BOVINO' },
  { codigo: '.02', nombre: 'M (Macho)', especie: 'BOVINO' },
  { codigo: '.03', nombre: 'A (Astrado)', especie: 'BOVINO' },
  { codigo: '.04', nombre: 'S (Sobre)', especie: 'BOVINO' },
  { codigo: '.05', nombre: 'I (Intermedia)', especie: 'BOVINO' },
  { codigo: '.06', nombre: 'N (Normal)', especie: 'BOVINO' },
  { codigo: '.07', nombre: 'AG', especie: 'BOVINO' },
  { codigo: '.08', nombre: 'AS', especie: 'BOVINO' },
  { codigo: '.09', nombre: 'L (Liviano)', especie: 'BOVINO' },
  { codigo: '.10', nombre: 'D', especie: 'BOVINO' },
  { codigo: '.11', nombre: 'O', especie: 'BOVINO' },
  { codigo: '.12', nombre: 'MM', especie: 'BOVINO' },
  { codigo: '.13', nombre: 'MP', especie: 'BOVINO' },
  { codigo: '.14', nombre: 'MD', especie: 'BOVINO' },
  { codigo: '.15', nombre: 'NN', especie: 'BOVINO' },
  { codigo: '.16', nombre: 'SIN', especie: 'BOVINO' },
  { codigo: '.17', nombre: 'IN (Industrial)', especie: 'BOVINO' },
  // Equinos (códigos diferentes para evitar duplicados)
  { codigo: '.E1', nombre: 'No tipificada', especie: 'EQUINO' },
  { codigo: '.E2', nombre: 'M (Macho)', especie: 'EQUINO' },
  { codigo: '.E3', nombre: 'A (Astrado)', especie: 'EQUINO' },
  { codigo: '.E7', nombre: 'AG (solo equino)', especie: 'EQUINO' },
  { codigo: '.E8', nombre: 'AS (solo equino)', especie: 'EQUINO' },
  { codigo: '.E9', nombre: 'IN (Industrial, solo equino)', especie: 'EQUINO' },
];

// Artículos/Cortes para EAN-128
const ARTICULOS = [
  { codigo: '000', nombre: 'TOTAL' },
  { codigo: '001', nombre: 'Lomo' },
  { codigo: '002', nombre: 'Bife Angosto' },
  { codigo: '003', nombre: 'Cuadril' },
  { codigo: '004', nombre: 'Nalga de Adentro' },
  { codigo: '005', nombre: 'Bola de Lomo' },
  { codigo: '006', nombre: 'Nalga de Afuera' },
  { codigo: '007', nombre: 'Cuadrada' },
  { codigo: '008', nombre: 'Peceto' },
  { codigo: '009', nombre: 'Colita de Cuadril' },
  { codigo: '010', nombre: 'Tortuguita' },
  { codigo: '011', nombre: 'Brazuelo' },
  { codigo: '012', nombre: 'Garrón' },
  { codigo: '013', nombre: 'Entraña' },
  { codigo: '014', nombre: 'Delantero Jaslo' },
  { codigo: '015', nombre: 'Paleta' },
  { codigo: '016', nombre: 'Centro de Paleta' },
  { codigo: '017', nombre: 'Corazón de Paleta' },
  { codigo: '018', nombre: 'Aguja' },
  { codigo: '019', nombre: 'Chingolo' },
  { codigo: '020', nombre: 'Marucha' },
  { codigo: '021', nombre: 'Cogote' },
  { codigo: '022', nombre: 'Cuello' },
  { codigo: '023', nombre: 'Azotillo' },
  { codigo: '024', nombre: 'Falda' },
  { codigo: '025', nombre: 'Falda con Hueso' },
  { codigo: '026', nombre: 'Asado' },
  { codigo: '027', nombre: 'Asado de Tira' },
  { codigo: '028', nombre: 'Vacío' },
  { codigo: '029', nombre: 'Matambre' },
  { codigo: '030', nombre: 'Costilla' },
  { codigo: '031', nombre: 'Aguja con Hueso' },
  { codigo: '032', nombre: 'Ojo de Bife' },
  { codigo: '033', nombre: 'Bife Ancho' },
  { codigo: '034', nombre: 'Bife de Chorizo' },
  { codigo: '035', nombre: 'Cara Cuadrada' },
  { codigo: '036', nombre: 'Contrafilete' },
  { codigo: '037', nombre: 'Rump' },
  { codigo: '038', nombre: 'Lomo Completo' },
  { codigo: '039', nombre: 'Media Res' },
  { codigo: '040', nombre: 'Cuarto Delantero' },
  { codigo: '041', nombre: 'Cuarto Trasero' },
];

async function main() {
  console.log('🚀 Iniciando carga de datos REALES...\n');

  // ==================== 1. CARGAR CLIENTES REALES ====================
  console.log('👥 Cargando clientes reales...');
  
  let clientesCount = 0;
  for (const clienteData of CLIENTES_REALES) {
    await prisma.cliente.upsert({
      where: { cuit: clienteData.cuit || `SIN_CUIT_${clienteData.nombre}` },
      update: {
        nombre: clienteData.nombre,
        email: clienteData.email,
        telefono: clienteData.telefono,
        esProductor: clienteData.esProductor,
        esUsuarioFaena: clienteData.esUsuarioFaena,
      },
      create: {
        nombre: clienteData.nombre,
        cuit: clienteData.cuit,
        email: clienteData.email,
        telefono: clienteData.telefono,
        esProductor: clienteData.esProductor,
        esUsuarioFaena: clienteData.esUsuarioFaena,
      }
    });
    clientesCount++;
  }
  
  console.log(`✅ ${clientesCount} clientes cargados/actualizados\n`);

  // ==================== 2. CARGAR CÓDIGOS EAN-128 ====================
  console.log('📊 Cargando tablas de códigos EAN-128...');
  
  // Especies
  for (const esp of CODIGOS_ESPECIE) {
    await prisma.codigoEspecie.upsert({
      where: { codigo: esp.codigo },
      update: { nombre: esp.nombre },
      create: { codigo: esp.codigo, nombre: esp.nombre }
    });
  }
  console.log(`  ✅ ${CODIGOS_ESPECIE.length} códigos de especie`);
  
  // Transportes
  for (const trans of CODIGOS_TRANSPORTE) {
    await prisma.codigoTransporte.upsert({
      where: { codigo: trans.codigo },
      update: { nombre: trans.nombre },
      create: { codigo: trans.codigo, nombre: trans.nombre }
    });
  }
  console.log(`  ✅ ${CODIGOS_TRANSPORTE.length} códigos de transporte`);
  
  // Destinos
  for (const dest of CODIGOS_DESTINO) {
    await prisma.codigoDestino.upsert({
      where: { codigo: dest.codigo },
      update: { nombre: dest.nombre },
      create: { codigo: dest.codigo, nombre: dest.nombre }
    });
  }
  console.log(`  ✅ ${CODIGOS_DESTINO.length} códigos de destino`);
  
  // Tipos de trabajo
  for (const trab of CODIGOS_TIPO_TRABAJO) {
    await prisma.codigoTipoTrabajo.upsert({
      where: { codigo: trab.codigo },
      update: { nombre: trab.nombre },
      create: { codigo: trab.codigo, nombre: trab.nombre }
    });
  }
  console.log(`  ✅ ${CODIGOS_TIPO_TRABAJO.length} códigos de tipo trabajo`);
  
  // Tipificaciones
  for (const tip of CODIGOS_TIPIFICACION) {
    await prisma.codigoTipificacion.upsert({
      where: { codigo: tip.codigo },
      update: { nombre: tip.nombre, especie: tip.especie as Especie },
      create: { 
        codigo: tip.codigo, 
        nombre: tip.nombre,
        especie: tip.especie as Especie
      }
    });
  }
  console.log(`  ✅ ${CODIGOS_TIPIFICACION.length} códigos de tipificación`);
  
  console.log('');

  // ==================== 3. CARGAR ARTÍCULOS/PRODUCTOS ====================
  console.log('🥩 Cargando artículos/cortes...');
  
  for (const art of ARTICULOS) {
    await prisma.producto.upsert({
      where: { codigo_especie: { codigo: art.codigo, especie: 'BOVINO' } },
      update: { nombre: art.nombre },
      create: {
        codigo: art.codigo,
        nombre: art.nombre,
        especie: 'BOVINO',
        requiereTipificacion: art.codigo !== '000' && art.codigo !== '039' && art.codigo !== '040' && art.codigo !== '041',
        activo: true,
      }
    });
  }
  console.log(`✅ ${ARTICULOS.length} artículos cargados\n`);

  // ==================== 4. CONFIGURACIÓN DEL FRIGORÍFICO ====================
  console.log('🏭 Verificando configuración del frigorífico...');
  
  const configExists = await prisma.configuracionFrigorifico.findFirst();
  if (!configExists) {
    await prisma.configuracionFrigorifico.create({
      data: {
        nombre: 'Solemar Alimentaria S.A.',
        numeroEstablecimiento: '3986',
        numeroMatricula: '300',
      }
    });
    console.log('✅ Configuración creada');
  } else {
    await prisma.configuracionFrigorifico.update({
      where: { id: configExists.id },
      data: {
        nombre: 'Solemar Alimentaria S.A.',
        numeroEstablecimiento: '3986',
        numeroMatricula: '300',
      }
    });
    console.log('✅ Configuración actualizada');
  }

  // ==================== 5. NUMERADORES ====================
  console.log('\n🔢 Verificando numeradores...');
  
  const numeradores = [
    { nombre: 'TROPA_BOVINO', ultimoNumero: 0, anio: new Date().getFullYear() },
    { nombre: 'TROPA_EQUINO', ultimoNumero: 0, anio: new Date().getFullYear() },
    { nombre: 'TICKET_PESAJE', ultimoNumero: 0, anio: new Date().getFullYear() },
    { nombre: 'FACTURA', ultimoNumero: 0, anio: new Date().getFullYear() },
    { nombre: 'CCIR', ultimoNumero: 0, anio: new Date().getFullYear() },
  ];
  
  for (const num of numeradores) {
    await prisma.numerador.upsert({
      where: { nombre: num.nombre },
      update: { anio: num.anio },
      create: { ...num }
    });
  }
  console.log('✅ Numeradores verificados');

  // ==================== RESUMEN ====================
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE DATOS CARGADOS');
  console.log('='.repeat(60));
  
  const stats = {
    clientes: await prisma.cliente.count(),
    codigosEspecie: await prisma.codigoEspecie.count(),
    codigosTransporte: await prisma.codigoTransporte.count(),
    codigosDestino: await prisma.codigoDestino.count(),
    codigosTipoTrabajo: await prisma.codigoTipoTrabajo.count(),
    codigosTipificacion: await prisma.codigoTipificacion.count(),
    productos: await prisma.producto.count(),
  };
  
  console.log(`👥 Clientes: ${stats.clientes}`);
  console.log(`📊 Códigos Especie: ${stats.codigosEspecie}`);
  console.log(`📊 Códigos Transporte: ${stats.codigosTransporte}`);
  console.log(`📊 Códigos Destino: ${stats.codigosDestino}`);
  console.log(`📊 Códigos Tipo Trabajo: ${stats.codigosTipoTrabajo}`);
  console.log(`📊 Códigos Tipificación: ${stats.codigosTipificacion}`);
  console.log(`🥩 Productos/Artículos: ${stats.productos}`);
  console.log('='.repeat(60));
  console.log('\n✅ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
