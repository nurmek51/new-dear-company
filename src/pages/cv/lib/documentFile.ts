import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export interface PickedDoc {
  name: string;
  size: number | null;
  uri: string;
  mimeType: string | null;
  /** web only */
  file: File | null;
}

/** Spec §3.1 server rule for resumes; cover letters are unvalidated server-side so we apply the same. */
export const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
export const DOC_MAX_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

/** Open the system file picker; null when the user cancels. */
export async function pickDocument(): Promise<PickedDoc | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: Object.values(MIME_BY_EXT),
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return {
    name: a.name,
    size: typeof a.size === 'number' ? a.size : null,
    uri: a.uri,
    mimeType: a.mimeType ?? null,
    file: a.file ?? null,
  };
}

/** Client-side validation (spec §3.1: .pdf/.doc/.docx/.txt, ≤5MB). Returns an error message or null. */
export function validateDocument(doc: PickedDoc, maxBytes = DOC_MAX_BYTES, exts = DOC_EXTENSIONS): string | null {
  const lower = doc.name.toLowerCase();
  if (!exts.some((e) => lower.endsWith(e))) {
    return `only ${exts.join(', ')} files are accepted`;
  }
  if (doc.size != null && doc.size > maxBytes) {
    return `the file is ${(doc.size / (1024 * 1024)).toFixed(1)} mb — the limit is ${Math.round(maxBytes / (1024 * 1024))} mb`;
  }
  return null;
}

/** Build a multipart body with the file under `field` (name differs per endpoint, spec §0.2). */
export function documentForm(field: string, doc: PickedDoc): FormData {
  const form = new FormData();
  if (Platform.OS === 'web' && doc.file) {
    form.append(field, doc.file, doc.name);
    return form;
  }
  const ext = doc.name.slice(doc.name.lastIndexOf('.')).toLowerCase();
  const type = doc.mimeType ?? MIME_BY_EXT[ext] ?? 'application/octet-stream';
  // React Native's FormData accepts {uri,name,type} descriptors for files.
  form.append(field, { uri: doc.uri, name: doc.name, type } as unknown as Blob);
  return form;
}
