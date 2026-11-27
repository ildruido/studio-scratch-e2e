import { artifactPlatform } from "../artifact";
import type { PlatformAdapter } from "../types";

const adapter: PlatformAdapter = { target: "artifact", create: () => artifactPlatform };
export default adapter;
