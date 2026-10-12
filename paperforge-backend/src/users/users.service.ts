import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { FirebaseService } from '../firebase/firebase.service.js';
import type { User } from './user.js';

export const USERS_COLLECTION = 'paperforge_users';

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase();
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService,
  ) {}

  private userRef(username: string) {
    return doc(this.firebase.firestore(), USERS_COLLECTION, username);
  }

  /** Creates the initial account once; existing accounts are never overwritten. */
  async onModuleInit() {
    const username = normaliseUsername(this.config.get<string>('SEED_USERNAME', 'forge'));
    const password = this.config.get<string>('SEED_PASSWORD', 'Forge@2026');
    const displayName = this.config.get<string>('SEED_DISPLAY_NAME', 'PaperForge Trader');
    try {
      const ref = this.userRef(username);
      if ((await getDoc(ref)).exists()) return;
      await setDoc(ref, {
        username,
        displayName,
        passwordHash: await bcrypt.hash(password, 10),
        createdAt: serverTimestamp(),
      });
      this.logger.log(`Created initial user "${username}"`);
    } catch (error) {
      this.logger.error(`Could not seed initial user: ${(error as Error).message}`);
    }
  }

  async verifyCredentials(username: string, password: string): Promise<User | null> {
    const snap = await getDoc(this.userRef(normaliseUsername(username)));
    const data = snap.data() as (User & { passwordHash: string }) | undefined;
    if (!data || !(await bcrypt.compare(password, data.passwordHash))) return null;
    return { username: data.username, displayName: data.displayName };
  }

  async findByUsername(username: string): Promise<User | null> {
    const data = (await getDoc(this.userRef(username))).data() as User | undefined;
    return data ? { username: data.username, displayName: data.displayName } : null;
  }
}
