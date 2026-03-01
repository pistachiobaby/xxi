import { RouteHandler } from "gadget-server";

const BOOT_TIME = Date.now();

const route: RouteHandler = async ({ reply }) => {
  await reply.send({ version: BOOT_TIME });
};

export default route;
