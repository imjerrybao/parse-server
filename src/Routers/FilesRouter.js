import PromiseRouter from '../PromiseRouter';
import express from 'express';
import BodyParser from 'body-parser';
import * as Middlewares from '../middlewares';
import { randomHexString } from '../cryptoUtils';
import mime from 'mime';
import Config from '../Config';

export class FilesRouter {
  
  getExpressRouter() {
    var router = express.Router();
    router.get('/files/:appId/:filename', this.getHandler);

    router.post('/files', function(req, res, next) {
      next(new Parse.Error(Parse.Error.INVALID_FILE_NAME,
        'Filename not provided.'));
    });

    router.post('/files/:filename',
      Middlewares.allowCrossDomain,
      BodyParser.raw({type: '*/*', limit: '20mb'}),
      Middlewares.handleParseHeaders,
      this.createHandler
    );

    router.delete('/files/:filename',
      Middlewares.allowCrossDomain,
      Middlewares.handleParseHeaders,
      Middlewares.enforceMasterKeyAccess,
      this.deleteHandler
    );
    return router;
  }
  
  getHandler(req, res, next) {
    const config = new Config(req.params.appId);
    const filesController = config.filesController;
    const filename = req.params.filename;
    filesController.getFileData(config, filename).then((data) => {
        res.status(200);
        var contentType = mime.lookup(filename);
        res.set('Content-type', contentType);
        res.end(data);
      }).catch((error) => {
        res.status(404);
        res.set('Content-type', 'text/plain');
        res.end('File not found.');
      });
  }
  
  createHandler(req, res, next) {
    if (!req.body || !req.body.length) {
      next(new Parse.Error(Parse.Error.FILE_SAVE_ERROR,
        'Invalid file upload.'));
      return;
    }

    if (req.params.filename.length > 128) {
      next(new Parse.Error(Parse.Error.INVALID_FILE_NAME,
        'Filename too long.'));
      return;
    }

    if (!req.params.filename.match(/^[_a-zA-Z0-9][a-zA-Z0-9@\.\ ~_-]*$/)) {
      next(new Parse.Error(Parse.Error.INVALID_FILE_NAME,
        'Filename contains invalid characters.'));
      return;
    }
    let extension = '';
    
    // Not very safe there.
    const hasExtension = req.params.filename.indexOf('.') > 0;
    const contentType = req.get('Content-type');
    if (!hasExtension && contentType && mime.extension(contentType)) {
      extension = '.' + mime.extension(contentType);
    }

    const filename = req.params.filename + extension;
    const config = req.config;
    const filesController = config.filesController;

    filesController.createFile(config, filename, req.body).then((result) => {
      res.status(201);  
      res.set('Location', result.url);
      res.json(result);
    }).catch((err) => {
       next(new Parse.Error(Parse.Error.FILE_SAVE_ERROR,
          'Could not store file.'));
    });
  }
  
  deleteHandler(req, res, next) {
    const filesController = req.config.filesController;
    filesController.deleteFile(req.config, req.params.filename).then(() => {
      res.status(200);
      // TODO: return useful JSON here?
      res.end();
    }).catch((error) => {
      next(new Parse.Error(Parse.Error.FILE_DELETE_ERROR,
        'Could not delete file.'));
    });
  }
}