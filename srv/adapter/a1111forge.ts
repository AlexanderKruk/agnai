import { AdapterProps, ModelAdapter } from './type';
import { registerAdapter } from './register';
import { AdapterSetting } from '../../common/adapters';
import { logger } from '../middleware';

// This ModelAdapter is primarily for registration purposes, as A1111 Forge image generation
// is handled via /srv/image/index.ts and /srv/image/a1111forge.ts.
export const handleA1111ForgeAdapter: ModelAdapter = async function* (opts: AdapterProps) {
  logger.info('[A1111ForgeAdapter] Text generation called, but this is an image service.');
  yield { error: 'A1111 Forge is an image generation service and does not support direct text generation through this adapter.' };
  // Optionally, if it needs to complete without error for some system check:
  // yield ''; // or yield { meta: { status: 'Image service, not for text' } };
  return;
};

const settings: AdapterSetting[] = [
  {
    field: 'info_a1111forge_note', // Changed field name slightly to avoid potential conflicts if 'info_a1111forge' was a real data field
    label: 'A1111 Forge Adapter Note',
    helperText:
      'This adapter is for A1111 Forge image generation. Configure its primary settings (URL, sampler) under Image Settings. This section is for system registration purposes.',
    secret: false, // Added missing property
    setting: { type: 'text' }, // Provide a valid SettingType, will likely be non-interactive or read-only text in UI based on context
    // type: 'info', // Removed problematic property
  },
  // We can still include a URL setting here if it's globally useful for the adapter registration,
  // but the primary URL for image generation is in ImageSettings.a1111forge.url
  // {
  //   field: 'a1111forge_base_url',
  //   label: 'A1111 Forge Base URL (Optional - Primarily for Info)',
  //   type: 'string',
  //   placeholder: 'http://localhost:7861',
  //   helperText: 'This is an informational field. The actual URL used for image generation is set in the Image Settings.',
  // },
];

registerAdapter('a1111forge', handleA1111ForgeAdapter, {
  label: 'A1111 Forge',
  type: 'image',
  isImage: true,
  isStreaming: false,
  isChat: false,
  settings,
  instructions: 'A1111 Forge is an image generation service. Configure its URL in Image Settings.',
  canStream: false,
  multiModal: false,
  options: [],
}); 