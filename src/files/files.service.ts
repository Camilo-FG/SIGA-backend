import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type UploadedFile = { buffer: Buffer; mimetype: string; size: number; originalname: string };

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

@Injectable()
export class FilesService {
  constructor(private readonly config: ConfigService) {}

  root() {
    return path.resolve(this.config.get<string>('UPLOAD_DIR', 'uploads'));
  }

  async save(folder: string, file: UploadedFile, allowed: string[], maxBytes: number) {
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Tipo de archivo no permitido');
    if (file.size > maxBytes) throw new BadRequestException('El archivo supera el tamaño permitido');
    const name = `${randomUUID()}${extensions[file.mimetype]}`;
    const directory = path.join(this.root(), folder);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, name), file.buffer);
    return path.posix.join(folder, name);
  }

  absolute(relativePath: string) {
    const root = this.root();
    const full = path.resolve(root, relativePath);
    if (full !== root && !full.startsWith(root + path.sep)) throw new BadRequestException('Ruta de archivo inválida');
    return full;
  }
}
