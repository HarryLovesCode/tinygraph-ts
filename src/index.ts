import _debug from "debug";

const debug = _debug("graph");

export type Ctx<T> = Readonly<T>;

type PatchFn<T> = (ctx: Ctx<T>) => Partial<Ctx<T>>;
type Patch<T> = Partial<Ctx<T>> | PatchFn<T>;

export type RunResult<T> = {
  context?: Patch<T>;
  transition?: string;
};

type NodeRes<T> = Promise<RunResult<T>> | RunResult<T> | Promise<void> | void;

/**
 * Interface for nodes to implement to be used in a `GraphBuilder`.
 * Follows patch pattern for updating context.
 */
export interface Node<T> {
  /**
   * Advances to the next node in the graph.
   *
   * @param state Current state leading up to this node.
   * @returns `NodeRes` with context patch and optional transition name.
   */
  next: (
    state: Ctx<T> & { context?: Ctx<T> },
    transitions: string[]
  ) => NodeRes<T>;
}

/**
 * Creates a directed graph of nodes that can be traversed based on
 * named transitions output from the `next` method of each node.
 */
export class Graph<T> {
  private _context: Ctx<T>;
  private _currentNode: { node: Node<T>; key: string } | undefined;
  private _transitions: Map<string, Set<string>> = new Map();
  private _nodes: Map<string, Node<T>> = new Map();

  constructor() {
    this._context = {} as Ctx<T>;
  }

  private applyPatch(context: Ctx<T>, patch?: Patch<T>) {
    if (!patch) return context;
    if (typeof patch === "function") {
      return {
        ...context,
        ...patch(context as Ctx<T>),
      } as Ctx<T>;
    }

    return {
      ...context,
      ...(patch as Partial<Ctx<T>>),
    } as Ctx<T>;
  }

  /**
   * Current graph context.
   */
  public get context() {
    return this._context;
  }

  /**
   * Current node key.
   */
  public get current() {
    return this._currentNode?.key;
  }

  /**
   * Available neighbors from the current node.
   */
  public get availableTransitions() {
    return this._transitions.get(this._currentNode!.key);
  }

  /**
   * Creates and edge between two graph nodes.
   *
   * @param l From node
   * @param r To node
   * @returns `this` for chaining.
   */
  public edge(l: string, r: string) {
    const existing = this._transitions.get(l);

    if (!existing) this._transitions.set(l, new Set([r]));
    else existing.add(r);

    return this;
  }

  /**
   * Creates a node given a key and the `NodeLike` to add.
   *
   * @param key Node name
   * @param toAdd Node to append to graph.
   * @returns `this` for chaining.
   */
  public node(key: string, toAdd: Node<T>) {
    this._nodes.set(key, toAdd);
    return this;
  }

  /**
   * Runs the graph from the current start node until completion.
   *
   * @param context Context for initial state.
   * @returns Finalized context upon completion.
   */
  public async run(context?: Patch<T>): Promise<Ctx<T>> {
    this._context = this.applyPatch(this._context, context);
    debug(`Initial context: ${JSON.stringify(this._context)}`);
    while (await this.step(context)) {}

    return this._context;
  }

  /**
   * Useful for stepping through the graph manually rather than running until
   * completion. If the current node returns no transition, the graph is done.
   *
   * If this is being used to debug, only pass the initial context on the first
   * invocation otherwise the context will be patched with the same initial values.
   *
   * @param context Context to patch into the current state.
   * @returns Boolean indicating if the graph is complete.
   */
  public async step(context?: Patch<T>): Promise<boolean> {
    this._context = this.applyPatch(this._context, context);
    debug(`Incoming context: ${JSON.stringify(this._context)}`);

    try {
      const res = await this._currentNode?.node.next(
        this._context,
        Array.from(this.availableTransitions || [])
      );

      if (!res) {
        debug("Done");
        return false;
      }

      const { context: patch, transition } = res;
      debug(`Incoming patch: ${JSON.stringify(patch)}`);

      if (patch) {
        this._context = this.applyPatch(this._context, patch);
      }

      debug(`Patched state: ${JSON.stringify(this._context)}`);

      if (!transition) {
        return false;
      }

      const neighbors = this._transitions.get(this._currentNode!.key);

      if (!neighbors?.has(transition)) {
        throw new Error(
          `Invalid transition from ${this._currentNode?.key} > ${transition}`
        );
      }

      debug(`Moving from ${this._currentNode?.key} to ${transition}`);
      this._currentNode = {
        node: this._nodes.get(transition)!,
        key: transition,
      };
    } catch (err) {
      console.error("Graph execution error. Stopping execution:");
      console.error(err);
      return false;
    }

    return true;
  }

  /**
   * Sets the entry point of the node graph. This must be called after
   * adding nodes.
   *
   * @param nodeName String name of node to begin with.
   * @returns `this` for chaining.
   */
  public setStart(nodeName: string) {
    if (!this._nodes.get(nodeName)) {
      throw new Error(
        "Cannot start from node that has not been registered in graph. " +
          "Start should be after adding nodes."
      );
    }

    this._currentNode = {
      node: this._nodes.get(nodeName)!,
      key: nodeName,
    };

    return this;
  }
}
