import { Router } from 'express';
import { store } from '../db';
import { handle } from './wrap';
import { AppSchema } from '../../common/types/schema';

const router = Router();

router.get('/characters', handle(async () => {
  const publicChars = await store.characters.getPublicCharacters();
  return { characters: publicChars };
}));

export default router; 