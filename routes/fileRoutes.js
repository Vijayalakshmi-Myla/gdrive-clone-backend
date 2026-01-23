import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { deleteFile, listFiles, listFilesKeyset, moveFile, renameFile, restoreFile, signedUrl, uploadFile } from '../controllers/fileController.js';

const upload = multer();
const router = Router();
router.use(authMiddleware);
router.get('/', listFiles); // offset pagination
router.get('/keyset', listFilesKeyset); // keyset pagination
router.post('/upload', upload.single('file'), uploadFile);
router.get('/:id/signed-url', signedUrl);
router.patch('/:id/rename', renameFile);
router.patch('/:id/move', moveFile);
router.delete('/:id', deleteFile);
router.post('/:id/restore', restoreFile);
export default router;
