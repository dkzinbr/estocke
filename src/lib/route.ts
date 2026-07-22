export type IdRouteContext = {
  params: Promise<{ id: string }>;
};

export type NestedLinkRouteContext = {
  params: Promise<{ id: string; linkId: string }>;
};
