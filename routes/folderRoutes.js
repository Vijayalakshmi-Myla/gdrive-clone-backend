import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { createFolder, deleteFolder, listFolders, moveFolder, renameFolder, restoreFolder } from "../controllers/folderController.js";

const router = Router();
router.use(authMiddleware);
router.get('/', listFolders);
router.post('/', createFolder);
router.patch('/:id/rename', renameFolder);
router.patch('/:id/move', moveFolder);
router.delete('/:id', deleteFolder);
router.post('/:id/restore', restoreFolder);
export default router;
