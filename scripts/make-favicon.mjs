import { promises as fs } from 'fs';
import path from 'path';

async function main(){
  const root = path.resolve('.');
  const sourcePng = path.join(root, 'public', 'favicon.png');
  const png = await fs.readFile(sourcePng);
  if (png.length < 24 || png.toString('ascii', 12, 16) !== 'IHDR'){
    throw new Error('Unexpected PNG structure for sadd-icon.png');
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);    // reserved
  iconDir.writeUInt16LE(1, 2);    // type: icon
  iconDir.writeUInt16LE(1, 4);    // one image

  const entry = Buffer.alloc(16);
  entry[0] = width >= 256 ? 0 : width;
  entry[1] = height >= 256 ? 0 : height;
  entry[2] = 0;                   // palette
  entry[3] = 0;                   // reserved
  entry.writeUInt16LE(1, 4);      // color planes
  entry.writeUInt16LE(32, 6);     // bit depth
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(iconDir.length + entry.length, 12);

  const ico = Buffer.concat([iconDir, entry, png]);

  const targets = [
    path.join(root, 'src', 'app', 'favicon.ico'),
    path.join(root, 'public', 'favicon.ico'),
  ];

  await Promise.all(targets.map(async(target)=>{
    await fs.writeFile(target, ico);
  }));

  console.log(`Generated favicon.ico with source size ${width}x${height}`);
}

main().catch((err)=>{
  console.error(err);
  process.exit(1);
});
