/** The RDF backend selected by this application's build and Node tests. */
import * as coreModule from '@muze-nl/oldm-core';
import {
  turtleParser,
  turtleWriter,
  turtlePatchWriter
} from '@muze-labs/oldm-turtle';

const { default: createContext, ...core } = coreModule;

export default {
  ...core,
  context({
    parser = turtleParser,
    writer = turtleWriter,
    patchWriter = turtlePatchWriter,
    ...options
  } = {}) {
    return createContext({ ...options, parser, writer, patchWriter });
  }
};
