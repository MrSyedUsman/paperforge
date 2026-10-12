import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/** Uses the Firebase web config, so no service-account key is needed. Firestore rules must allow access. */
@Injectable()
export class FirebaseService {
  private readonly db;

  constructor(config: ConfigService) {
    const app = getApps().length
      ? getApp()
      : initializeApp({
          apiKey: config.get<string>('FIREBASE_API_KEY'),
          authDomain: config.get<string>('FIREBASE_AUTH_DOMAIN'),
          projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
          appId: config.get<string>('FIREBASE_APP_ID'),
        });
    const databaseId = config.get<string>('FIRESTORE_DATABASE_ID');
    this.db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }

  firestore() {
    return this.db;
  }
}
