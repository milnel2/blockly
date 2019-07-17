/**
 * @fileoverview The class for generating accessible linearization
 * of a workspace, and a helper classes
 */

goog.provide('Blockly.Linearization');
goog.provide('Blockly.Linearization.BlockJoiner');

// regex selector and replace, only works with single line arg lists, 40 targets
//(\w+)( = function\(.*\)\s*\{)
//$1$2\n  if(!counter.$1) counter.$1 = [];\n  counter.$1.push(new Error(arguments).stack);\n
var counter = {
  summarize: function() {
    this.fillAllFields();
    this.keys().map(k => [k, this[k]]).sort((a, b) => a[1].length - b[1].length).forEach(o => console.log(o[0], o[1].length));
  },
  fillAllFields: function() {
    for (var name in workspace.linearization.blockJoiner) {
      if (typeof workspace.linearization.blockJoiner[name] !== 'function') {
        continue;
      }
      if (!this[name]) {
        this[name] = [];
      }
    }
    for (var name in workspace.linearization) {
      if (typeof workspace.linearization[name] !== 'function') {
        continue;
      }
      if (!this[name]) {
        this[name] = [];
      }
    }
  },
  dump: function() {
    for (let prop in this) {
      console.log(prop, this[prop]);
    }
  },
  keys: function() {
    return Object.keys(this)
      .filter(k => !['makeCoverageHook', 'keys', 'dump', 'fillAllFields', 'summarize'].includes(k));
  },
  makeCoverageHook: function(name) {
    return '  if (!counter.' + name + ') counter.' + name +
      ' = [];\n  counter.' + name + '.push(new Error(arguments).stack)\n';
  }
};

/**
 * Class for generating the linearization of a workspace, displayed in parent
 * nav and mainNavList.
 *
 * @constructor
 * @param {!Blockly.Workspace} workspace the main workspace to represent
 * @param {!HTMLElement} parentNav the p element to display the parent
 * breadcrumbs within
 * @param {!HTMLElement} mainNavList the p element to display the main
 * linearization of workspace within
 */
Blockly.Linearization = function(workspace, parentNav, mainNavList) {
  if(!counter.Linearization) counter.Linearization = [];
  counter.Linearization.push(new Error(arguments).stack);

  /** @const */
  this.workspace = workspace;

  /** @const */
  this.blockJoiner = new Blockly.Linearization.BlockJoiner();

  /**
   * The element to generate parent nav in
   * @type {HTMLElement}
   */
  this.parentNav = parentNav;

  /**
   * The element to generate the main linearization in
   * @type {HTMLElement}
   */
  this.mainNavList = mainNavList;


  // ***Requires Localization***
  /** @const @private */
  this.blankText_ = 'NOTHING';

  workspace.addChangeListener(e => this.generateList_(e));
}

/**
 * Class to manage potential connections.
 * Allows for a single potential connection or block at a time.
 * @constructor
 */
Blockly.Linearization.BlockJoiner = function() {
  if(!counter.BlockJoiner) counter.BlockJoiner = [];
  counter.BlockJoiner.push(new Error(arguments).stack);

  /**
   * The block to move
   * @type {Blockly.ASTNode}
   */
  this.blockNode = null;

  /**
   * The connection to attach to
   * @type {Blockly.ASTNode}
   */
  this.connectionNode = null;
}

/**
 * Attempt to connect this item. item must be Blockly.Block or
 * Blockly.Connection.
 * @param {Block.ASTNode} item
 * @return {boolean} true if successfully pushed, false if push fails. Note:
 * a push can be successful without moving the block/connecting the connection
 */
Blockly.Linearization.BlockJoiner.prototype.push = function(item) {
  if(!counter.push) counter.push = [];
  counter.push.push(new Error(arguments).stack);

  if (item.getLocation() instanceof Blockly.Block) {
    this.blockNode = item;
  } else if (item.getLocation() instanceof Blockly.Connection) {
    var parentBlocks = item.getParentStack(true).map(n => n.getLocation());
    if (this.blockNode && parentBlocks.includes(this.blockNode.getLocation())) {
      return false;
    }
    this.connectionNode = item;
  } else {
    console.warn('fell through push types', item)
    return false;
  }

  this.service_();
  return true;
}

/**
 * Attempt to pair blockNode and connectionNode. If successful, join the
 * connections, and then clear the properties.
 * @private
 */
Blockly.Linearization.BlockJoiner.prototype.service_ = function() {
  if(!counter.service_) counter.service_ = [];
  counter.service_.push(new Error(arguments).stack);

  if (!this.blockNode || !this.connectionNode) {
    return;
  }

  var insertPointNode = this.connectionNode;
  var advance, back;
  // define advance and back by the direction the connection node requests
  switch (insertPointNode.getType()) {
    case Blockly.ASTNode.types.NEXT:
    // fall through, same behavior
    case Blockly.ASTNode.types.INPUT:
      advance = n => n.next();
      back = n => n.prev();
      break;
    case Blockly.ASTNode.types.PREVIOUS:
    // fall through, same behavior
    case Blockly.ASTNode.types.OUTPUT:
      advance = n => n.prev();
      back = n => n.next();
      break;
    default:
      console.warn('fell through', insertPointNode);
      return;
  }

  // connect this.blockNode and this.connectionNode
  var provided = this.blockNode;
  var providedBlock = back(provided).getLocation();

  try {
    var detach = [Blockly.ASTNode.types.PREVIOUS, Blockly.ASTNode.types.OUTPUT];
    if (provided.prev() && provided.prev().prev()
        && detach.includes(provided.prev().getType())) {
      provided.prev().getLocation().disconnect();
      provided.prev().getLocation().bumpNeighbours_();
    }
  } catch (e) { /* unsuccessful disconnect or bump */  }

  try {
    insertPointNode.getLocation().connect(providedBlock);
  } catch (e) {
    console.warn(e);
    if (e instanceof DOMException) {
      document.location.reload();
    }
  }
  // clear the values
  this.connectionNode = null;
  this.blockNode = null;
}

/**
 * ONLY USED ONCE!
 * Attempts to disconnect the current block in this.blockNode and put in on the
 * workspace. Nulls this.blockNode if successful
 */
Blockly.Linearization.BlockJoiner.prototype.disconnectBlock = function() {
  if(!counter.disconnectBlock) counter.disconnectBlock = [];
  counter.disconnectBlock.push(new Error(arguments).stack);
  
  try {
    this.blockNode.prev().getLocation().disconnect();
    this.blockNode.getLocation().bumpNeighbours_();
    this.blockNode = null;
  } catch (e) { /* unsuccessful disconnect/bump */ }
}

/**
 * ONLY USED ONCE!
 * Checks if the block in this.blockNode is equal to the block in node
 * @param {Blockly.ASTNode} node the node to compare to
 * @return {Boolean} true if they contain the same block and are not null, false
 * otherwise
 */
Blockly.Linearization.BlockJoiner.prototype.blockIs = function(node) {
  if(!counter.blockIs) counter.blockIs = [];
  counter.blockIs.push(new Error(arguments).stack);

  return this.blockNode && node && this.blockNode.getLocation().id != undefined
    && this.blockNode.getLocation().id === node.getLocation().id;
};

/**
 * The EventListener for workspace events. On fire, fully redraws linearization,
 * including parentNav.
 * @param {?Blockly.Events.Abstract} e the workspace event that triggers this
 * EventListener.
 * @private
 */
Blockly.Linearization.prototype.generateList_ = function(e) {
  if(!counter.generateList_) counter.generateList_ = [];
  counter.generateList_.push(new Error(arguments).stack);

  var workspace = this.workspace;
  if (!workspace.getAllBlocks().length) {
    this.mainNavList.innerHTML = '';
    return;
  }

  if (e) {
    this.alterSelectedWithEvent_(e);
  }

  this.generateParentNav_(this.selectedNode);

  var navListDiv = this.mainNavList;
  var newDiv = this.selectedNode?
      this.makeNodeList_(this.selectedNode):
      this.makeWorkspaceList_();

  newDiv.setAttribute('id', 'mainNavList');
  navListDiv.parentNode.replaceChild(newDiv, navListDiv);
  this.mainNavList = newDiv;
}

/**
 * Takes a workspace event and uses the type of event to determine the next
 * selectedNode.
 * @param {!Blockly.Events.Abstract} e the workspace event that determines the
 * next selectedNode.
 * @private
 */
Blockly.Linearization.prototype.alterSelectedWithEvent_ = function(e) {
  if(!counter.alterSelectedWithEvent_) counter.alterSelectedWithEvent_ = [];
  counter.alterSelectedWithEvent_.push(new Error(arguments).stack);

  var node;

  switch (e.type) {
    case Blockly.Events.BLOCK_MOVE:
      var block = this.workspace.getBlockById(e.blockId);
      node = block && Blockly.ASTNode.createBlockNode(block);
      if (block && this.blockJoiner.connectionNode) {
        this.blockJoiner.push(node);
      }
      break;
    case Blockly.Events.BLOCK_CREATE:
      var block = this.workspace.getBlockById(e.blockId);
      node = block && Blockly.ASTNode.createBlockNode(block);
      break;
    case Blockly.Events.UI:
      if (e.element !== 'selected' && e.element !== 'click') {
        node = this.selectedNode;
      } else if (!e.blockId) {
        node = null;
      } else {
        var block = this.workspace.getBlockById(e.blockId);
        node = Blockly.ASTNode.createBlockNode(block);
        if (this.blockJoiner.connectionNode) {
          this.blockJoiner.push(node);
        }
      }
      break;
    case Blockly.Events.BLOCK_DELETE:
    // fall through, same behavior
    case Blockly.Events.FINISHED_LOADING:
      node = null;
      break;
  }

  this.listItemOnclick_(node);
}

/**
 * Generates (and replaces) the old parent-nav bar, using color-coded, linked
 * breadcrumbs. Always includes workspace.
 * @param {!Blockly.Workspace} Current workspace
 * @param {?Blockly.ASTNode} rooNode Generates breadcrumbs from rootNode's
 * parentStack up to and including rootNode.
 * @private
 */
Blockly.Linearization.prototype.generateParentNav_ = function(rootNode) {
  if(!counter.generateParentNav_) counter.generateParentNav_ = [];
  counter.generateParentNav_.push(new Error(arguments).stack);

  var pNav = this.parentNav;
  pNav.innerHTML = '';
  pNav.appendChild(this.makeParentItem_());

  if (rootNode) {
    rootNode.getParentStack(true)
        .filter(node => node.getType() === Blockly.ASTNode.types.BLOCK)
        .reverse()
        .map(node => this.makeParentItem_(node))
        .forEach(elem => pNav.appendChild(elem));
  }

  // add movement options...
  // ...cancel move item...
  var blockNode = this.blockJoiner.blockNode;
  if (this.blockJoiner.connectionNode || blockNode) {
    pNav.appendChild(document.createElement('br'));
    var cancelItem = document.createElement('b');
    // ***Requires Localization***
    cancelItem.appendChild(document.createTextNode('Cancel Move'));
    cancelItem.addEventListener('click', e => {
        if (this.blockJoiner.connectionNode) {
          this.blockJoiner.connectionNode = null;
        } else {
          this.blockJoiner.blockNode = null;
        }
        this.generateList_();
    });
    pNav.appendChild(cancelItem);
  }

  // ...delete block item...
  if (blockNode && !this.selectedNode) {
    pNav.appendChild(document.createElement('br'));
    var deleteItem = document.createElement('b');
    // ***Requires Localization***
    var text = 'Delete ' + blockNode.getLocation().makeAriaLabel();
    deleteItem.appendChild(document.createTextNode(text));
    deleteItem.addEventListener('click', e => {
      this.blockJoiner.blockNode = null;
      blockNode.getLocation().dispose(true);
    })

    // ...make into new stack item
    if (blockNode.prev()) {
      // if this has the ability to be mid-stack (unlike hat blocks)
      pNav.appendChild(deleteItem);
      pNav.appendChild(document.createElement('br'));
      var newStackItem = document.createElement('b');
      // ***Requires Localization***
      newStackItem.appendChild(document.createTextNode('Start new stack'));
      newStackItem.addEventListener('click', e => {
        this.blockJoiner.disconnectBlock();
      });
      pNav.appendChild(newStackItem);
    }
  }
}

/**
 * Creates and returns the HTML unordered list of labelled stacks with sublists
 * of every block on the same visual indent, represented with list elements
 * @return {HTMLElement} an html representation of the top level of the current
 * workspace, in the form of an unordered list.
 * @private
 */
Blockly.Linearization.prototype.makeWorkspaceList_ = function() {
  if(!counter.makeWorkspaceList_) counter.makeWorkspaceList_ = [];
  counter.makeWorkspaceList_.push(new Error(arguments).stack);

  var workspace = this.workspace;
  var wsNode = Blockly.ASTNode.createWorkspaceNode(workspace);
  var wsList = document.createElement('ul');

  // for each stack
  var firstStack = wsNode.in();
  var stacks = firstStack.sequence(n => n.next());
  this.marker = 'A';

  // is in move mode? partial: full;
  var mappingFn = this.blockJoiner.blockNode?
      stack => this.makePartialStackItem_(stack):
      stack => this.makeFullStackItem_(stack);

  stacks.map(mappingFn).forEach(item => wsList.append(item));

  return wsList;
}

/**
 * Generates the stack item that contains all the top-level information
 * as well as movement options for the provided stack. Designed for use during
 * move operations
 * @param {!Blockly.ASTNode} stack the stack to represent
 * @return {HTMLElement} a list element describing the top-level of the stack as
 * a color-coded, linked sublist
 */
Blockly.Linearization.prototype.makePartialStackItem_ = function(stack) {
  if(!counter.makePartialStackItem_) counter.makePartialStackItem_ = [];
  counter.makePartialStackItem_.push(new Error(arguments).stack);

  var stackItem = document.createElement('li');
  // ***Requires Localization***
  stackItem.appendChild(document.createTextNode('Stack ' + this.marker));
  this.marker = Blockly.Linearization.nextStackMarker(this.marker);
  var stackItemList = document.createElement('ul');

  // for each block node in the top of the stack
  var firstNode = stack.in();
  if (firstNode.getType() !== Blockly.ASTNode.types.BLOCK) {
    firstNode = firstNode.getFirstSiblingBlock();
  }

  // add a new list element representing the block to the list
  firstNode.sequence(n => n.getFirstSiblingBlock())
    .map(node => this.makeNodeListItems_(node))
    .forEach(items => stackItemList.append(...items));

  stackItem.appendChild(stackItemList);
  return stackItem;
}

/**
 * Generates the html li that contains listings for all items in the stack
 * @param {!Blockly.ASTNode} stackNode the stack to represent
 * @return {HTMLElement} a list element describing the complete stack as
 * a color-coded, linked sublist
 */
Blockly.Linearization.prototype.makeFullStackItem_ = function(stackNode) {
  if(!counter.makeFullStackItem_) counter.makeFullStackItem_ = [];
  counter.makeFullStackItem_.push(new Error(arguments).stack);

  var stackItem = document.createElement('li');
  var oldName = '';
  // ***Requires Localization***
  var stackElem =
      Blockly.Linearization.makeListTextItem_('Stack ' + this.marker);
  stackElem.contentEditable = true;
  stackElem.addEventListener('focus', (e) => {
    oldName = stackElem.innerText.slice(6);
    stackElem.innerText = oldName;
  });
  stackElem.addEventListener('blur', (e) => {
    if (stackElem.innerText === "") {
      stackElem.innerText = 'Stack ' + oldName;
    } else {
      var newName = stackElem.innerText;
      stackElem.innerText = 'Stack ' + newName;
    }
  });
  stackItem.appendChild(stackElem);
  this.marker = Blockly.Linearization.nextStackMarker(this.marker);
  var stackItemList = document.createElement('ul');

  // first block in stack
  var blockNode = stackNode.in();
  if (blockNode.getType() !== Blockly.ASTNode.types.BLOCK) {
    blockNode = blockNode.getFirstSiblingBlock();
  }
  var rootBlock = blockNode.getLocation();
  blockNode.sequence(n => n.getFirstSiblingBlock())
    .map(node => this.makeListForBlock_(node, rootBlock))
    .forEach(items => stackItemList.append(...items));

  stackItem.appendChild(stackItemList);
  return stackItem;
}

/**
 * Takes in a block node and recursively makes the list of elements for all
 * descendant blocks.
 * Excludes inline blocks, such as those found in the repeat x times block.
 * @param {Blockly.ASTNode} blockNode the block AST node to start from
 * @param {Blockly.Block} rootBlock the block at which blockNode points to
 * @return {Array<HTMLElement>} an array containing all elements for descendants
 * @private
 */
Blockly.Linearization.prototype.makeListForBlock_ = function(blockNode, rootBlock) {
  if(!counter.makeListForBlock_) counter.makeListForBlock_ = [];
  counter.makeListForBlock_.push(new Error(arguments).stack);

  var block = blockNode.getLocation();
  var nestedName = this.getNestingBlockName_(block);
  // ***Requires Localization***
  var endList = nestedName?
    [Blockly.Linearization.makeListTextItem_('end ' + nestedName)]: [];

  if (blockNode.getType() !== Blockly.ASTNode.types.BLOCK
    || (block.outputConnection && block.getParent())
    || block.getRootBlock() !== rootBlock) {
    return endList;
  }

  var descendantItems = [];

  if (block.type === 'controls_if') {
    var listElems = this.makeIfListItems_(blockNode);
    var childNodes = Blockly.Linearization.getIfChildrenNodes_(blockNode);
    for (var i = 0; i < listElems.length; i++) {
      if (block.getSurroundParent()) {
        // ***Requires Localization***
        listElems[i].setAttribute('aria-label', listElems[i].innerHTML
        + ', inside ' + this.getNestingBlockName_(block.getSurroundParent()));
      }
      listElems[i].removeChild(listElems[i].childNodes[1]);
      var nestedItemList = document.createElement('ul');
      if (childNodes[i]) {
        childNodes[i].sequence(n => n.getFirstSiblingBlock())
          .map(node => this.makeListForBlock_(node, rootBlock))
          .forEach(items => nestedItemList.append(...items));
      }
      descendantItems.push(listElems[i]);
      descendantItems.push(nestedItemList);
    }
  } else {
    var listElem = this.makeBasicListItem_(blockNode);
    if (block.getSurroundParent()) {
      // ***Requires Localization***
      listElem.setAttribute('aria-label', listElem.innerHTML
        + ', inside ' + this.getNestingBlockName_(block.getSurroundParent()));
    }
    descendantItems.push(listElem);
    if (blockNode.getFirstNestedBlock()) {
      var nestedItemList = document.createElement('ul');
      blockNode.getFirstNestedBlock().sequence(n => n.getFirstSiblingBlock())
        .map(node => this.makeListForBlock_(node, rootBlock))
        .forEach(items => nestedItemList.append(...items));

      if (block.type === 'procedures_defreturn') {
        nestedItemList.append(this.makeReturnItem_(blockNode));
      }

      descendantItems.push(nestedItemList);
    }
  }

  return descendantItems.concat(endList);
}

/**
 * Takes in a nesting block (e.g. if, repeat while, etc.) and returns a
 * shorthand human-readable identifier.
 * @param {Blockly.Block} block the block to find a name for
 * @return {string} readable identifier for the nesting block
 * @private
 */
Blockly.Linearization.prototype.getNestingBlockName_ = function(block) {
  if(!counter.getNestingBlockName_) counter.getNestingBlockName_ = [];
  counter.getNestingBlockName_.push(new Error(arguments).stack);

  // ***Requires Localization***
  var blockNames = {
    'controls_if': 'if',
    'controls_repeat_ext': 'repeat',
    'controls_forEach': 'for each',
    'controls_for': 'for',
    'procedures_defnoreturn': 'function',
    'procedures_defreturn': 'function',
    'controls_whileUntil': 'repeat while'
  }
  if ((block.type === 'controls_whileUntil'
      && block.inputList[0].fieldRow[1].getText() === 'until')) {
    blockNames['controls_whileUntil'] = 'repeat until';
  }
  return blockNames[block.type];
}

/**
 * Creates and returns the HTML unordered list of every block on the same visual
 * indent within the rootNode, represented with list elements
 * @param {!Blockly.ASTNode} rootNode the direct parent of all items in the list
 * @return {HTMLElement} an html representation of the top level of the
 * rootNode, in the form of an unordered list.
 * @private
 */
Blockly.Linearization.prototype.makeNodeList_ = function(rootNode) {
  if(!counter.makeNodeList_) counter.makeNodeList_ = [];
  counter.makeNodeList_.push(new Error(arguments).stack);

  var sublist = document.createElement('ul');
  sublist.appendChild(this.makeGoBackItem_(rootNode));

  var showOnBranch = !this.selectedNode.branch || !this.selectedNode.branch.key;
  if (showOnBranch) {
    sublist.appendChild(this.makeMoveItem_(rootNode));
  }

  var warning = rootNode.getLocation().warning;
  if (warning && warning.getText && warning.getText().trim().length) {
    var warnItem = Blockly.Linearization.makeListTextItem_(warning.getText());
    warnItem.setAttribute('style', 'color:rgb(250, 50, 50)');
    sublist.appendChild(warnItem);
  }

  var connNode = this.blockJoiner.connectionNode;
  var inlineOutputConn = connNode && connNode.getParentInput() &&
      connNode.getParentInput().type === Blockly.INPUT_VALUE;

  var prevConn = rootNode.prev();
  if (prevConn && connNode) {
    // ***Requires Localization***
    sublist.appendChild(this.makeConnListItem_(rootNode, prevConn,
        inlineOutputConn? 'Tack me on side of': 'Insert me below',
        'Insert above me'));
  }

  var inline = rootNode.getFirstInlineBlock();
  var isIfNode = rootNode.getLocation().type === 'controls_if';
  if (inline && !isIfNode) {
    inline.sequence(Blockly.Linearization.nextInlineInput)
      .map(node => this.makeInputListItem_(node))
      .filter(Boolean)
      .forEach(elem => sublist.appendChild(elem));
  }

  if (rootNode.getLocation().mutator && (!isIfNode || showOnBranch)) {
    sublist.append(...this.makeAllMutatorItems_(rootNode));
  }

  var inNode = rootNode.in();
  while (inNode && inNode.getType() !== Blockly.ASTNode.types.INPUT) {
    inNode = inNode.next();
  }

  var firstNested = rootNode.getFirstNestedBlock();

  if (isIfNode) {
    sublist.append(...this.makeIfListItems_(rootNode));
  } else if (firstNested) {
    firstNested.sequence(n => n.getFirstSiblingBlock())
        .map(node => this.makeNodeListItems_(node))
        .forEach(elems => sublist.append(...elems));
  } else if (!connNode && inNode) {
    sublist.append(...this.makeAllInnerInputItems_(inNode));
  }

  if (rootNode.getLocation().type === 'procedures_defreturn') {
    sublist.appendChild(this.makeReturnItem_(rootNode));
  }

  return sublist;
}

/**
 * Returns all inner input nodes as a array of html elements, starting with
 * inNode.
 * @param {!Blockly.ASTNode} inNode the first inner input element to convert
 * @return {Array<HTMLElement>} an array containing all inner input elements
 * encoded as html list items
 * @private
 */
Blockly.Linearization.prototype.makeAllInnerInputItems_ = function(inNode) {
  if(!counter.makeAllInnerInputItems_) counter.makeAllInnerInputItems_ = [];
  counter.makeAllInnerInputItems_.push(new Error(arguments).stack);

  if (!this.blockJoiner.blockNode) {
    return [];
  }
  var inNodeSeq = inNode.sequence(n => n.next());
  var tracker = {
    tackVal: 1,
    insertVal: 1,
    tackText: function() {
      if (tracker.tackVal === 1 && inNodeSeq.length <= 1) {
        tracker.tackVal++;
        return '';
      }
      return inNodeSeq.length <= 1? '': ' ' + tracker.tackVal++;
    },
    insertText: function() {
      if (tracker.insertVal === 1 && inNodeSeq.length <= 1) {
        tracker.insertVal++;
        return '';
      }
      return inNodeSeq.length <= 1? '': ' ' + tracker.insertVal++;
    }
  }
  return inNodeSeq.map(n => this.makeBasicConnListItem_(
            n,
            // ***Requires Localization***
            n.getParentInput() && n.getParentInput().type === Blockly.INPUT_VALUE?
                'Tack on side' + tracker.tackText():
                'Insert within' + tracker.insertText())
          );
}

/**
 * Returns all mutator options for the block rootNode wraps in an array.
 * @param {!Blockly.ASTNode} node node containing the block with mutator
 * @return {Array<HTMLElement>} an array containing all mutator options encoded
 * as html list items.
 * @private
 */
Blockly.Linearization.prototype.makeAllMutatorItems_ = function(node) {
  if(!counter.makeAllMutatorItems_) counter.makeAllMutatorItems_ = [];
  counter.makeAllMutatorItems_.push(new Error(arguments).stack);

  var block = node.getLocation();
  var list = [];

  const alterAttr = (attrStr, fn) =>
    function(obj) {
      // null when no mutations (ie basic if block)
      var mutXml = obj.mutationToDom() || document.createElement('mutation');
      var old = parseInt(mutXml.getAttribute(attrStr), 10) || 0;
      mutXml.setAttribute(attrStr, fn(old));
      obj.domToMutation(mutXml);
    };

  const incrAttr = (attrStr) => alterAttr(attrStr, n => n + 1);
  const decrAttr = (attrStr) => alterAttr(attrStr, n => n - 1);

  if (block.elseifCount_ != undefined) {
    // ***Requires Localization***
    list.push(this.makeMutatorListItem_(node, 'Add elseif', block => {
      incrAttr('elseif')(block);
      this.listItemOnclick_(node, null);
    }));

    if (block.elseifCount_ > 0) {
      // ***Requires Localization***
      list.push(this.makeMutatorListItem_(node, 'Remove elseif', block => {
        decrAttr('elseif')(block);
        this.listItemOnclick_(node, null);
      }));
    }
  }

  if (block.elseCount_ === 0) {
    // ***Requires Localization***
    list.push(this.makeMutatorListItem_(node, 'Add else', block => {
      incrAttr('else')(block);
      this.listItemOnclick_(node, null);
    }));
  } else if (block.elseCount_ === 1) {
    // ***Requires Localization***
    list.push(this.makeMutatorListItem_(node, 'Remove else', block => {
      var elseBranch = Blockly.Linearization.getIfBranches(node).pop();
      if (elseBranch && elseBranch.bodyConnection) {
        elseBranch.bodyConnection.disconnect();
      }
      decrAttr('else')(block);
      this.listItemOnclick_(node, null);
    }));
  }

  if (block.itemCount_ !== undefined) {
    // ***Requires Localization***
    list.push(this.makeMutatorListItem_(node, 'Add item', incrAttr('items')));

    if (block.itemCount_ > 0) {
      // ***Requires Localization***
      list.push(
        this.makeMutatorListItem_(node, 'Remove item', decrAttr('items')));
    }
  }

  if (block.arguments_ != undefined) {
    // ***Requires Localization***
    list.push(this.makeMutatorListItem_(node, 'Add argument', block => {
      var argname;
      if (block.arguments_.length) {
        var lastArg = block.arguments_[block.arguments_.length - 1];
        argname = (lastArg.length > 5)? lastArg:
          Blockly.Linearization.nextStackMarker(lastArg);
      } else {
        argname = 'A';
      }

      while (block.arguments_.includes(argname)) {
        argname += 'I';
      }
      var newVar = this.workspace.createVariable(argname);
      block.arguments_.push(argname);
      block.argumentVarModels_.push(newVar);
      block.updateParams_();
      this.listItemOnclick_(node);
    }));

    block.arguments_.forEach(arg => {
      var elem = Blockly.Linearization.makeListTextItem_(
        'Argument \"' + arg + '\"');
      elem.contentEditable = true;
      elem.addEventListener('focus', (e) => elem.innerText = arg);
      elem.addEventListener('blur', (event) => {
        if (elem.innerText === "") {
          block.arguments_.splice(block.arguments_.indexOf(arg), 1);
          block.updateParams_();
          this.listItemOnclick_(node);
        } else {
          var argModel = block.getVarModels()[block.arguments_.indexOf(arg)];
          workspace.renameVariableById(argModel.getId(), elem.innerText);
          block.updateParams_();
        }
      });

      list.push(elem);
    })
  }

  return list;
}

/**
 * Returns an html list item that encodes the mutator option defined by text,
 * with source node rootNode, and onclick listener innerFn that accepts
 * rootNode.getLocation(). (listItemOnclick_(rootNode) is performed
 * automatically.)
 * @param {!Blockly.ASTNode} rootNode node containing the block with mutator
 * @param {!string} text option text
 * @param {!function(Blockly.Block)} additional onclick listener that accepts
 * rootNode.getLocation()
 * @return {HTMLElement} an html list item encoding the mutator option defined
 * by rootNode and text, with onclick behavior innerFn(rootNode.getLocation())
 * @private
 */
Blockly.Linearization.prototype.makeMutatorListItem_ = function(rootNode, text, innerFn) {
  if(!counter.makeMutatorListItem_) counter.makeMutatorListItem_ = [];
  counter.makeMutatorListItem_.push(new Error(arguments).stack);

  var block = rootNode.getLocation();
  var elem = Blockly.Linearization.makeListTextItem_(text);
  elem.addEventListener('click', e => {
    innerFn(block);
    this.listItemOnclick_(rootNode);
  })
  return elem;
}

/**
 * ONLY USED ONCE!
 * Returns the appropriate html list item for the connection,
 * attempting to validate the connection if such a connection is possible
 * @param {!Blockly.ASTNode} rootNode the current selectedNode from which
 * candidate is being collected
 * @param {!Blockly.ASTNode} candidate the item to validate for completing the
 * connection in this.blockJoiner, a child node of rootNode
 * @param {!string} text the text stub which describes the nature of the action
 * this item represents if the connection to candidate is valid
 * @param {!string} alttext the text stub which describes the nature of the action
 * this item represents if the connection to candidate is not valid
 * @return {HTMLElement} the appropriate html element to represent this
 * potential connection
 * @private
 */
Blockly.Linearization.prototype.makeConnListItem_ = function(rootNode, candidate, text, alttext) {
  if(!counter.makeConnListItem_) counter.makeConnListItem_ = [];
  counter.makeConnListItem_.push(new Error(arguments).stack);

  var connNode = this.blockJoiner.connectionNode;
  if (!connNode) {
      return this.makeBasicConnListItem_(candidate, alttext);
  }

  var conn = connNode.getLocation();
  var check = conn.canConnectWithReason_(candidate.getLocation());
  if (check === Blockly.Connection.CAN_CONNECT) {
    var label = text + ' ' + conn.getSourceBlock().makeAriaLabel();
    return this.makeBasicConnListItem_(rootNode, label);
  } else if (check === Blockly.Connection.REASON_SELF_CONNECTION) {
    // ***Requires Localization***
    var item = Blockly.Linearization.makeListTextItem_('Cancel insert');
    item.addEventListener('click', e => {
      this.blockJoiner.connectionNode = null;
      this.generateList_();
    });
    return item;
  }

  return this.makeBasicConnListItem_(candidate, alttext);
}

/**
 * Returns a list text element with a unique id and block id of the node
 * passed it, as well as a custom onclick listener that pushes the attached node
 * to the this.blockJoiner and regenerate's the list
 * @param {!Blockly.ASTNode} node the node that contains the connection this
 * html element represents
 * @param {!string} text the text for this list item
 * @return {HTMLElement} a clickable list item that represents the connection
 * @private
 */
Blockly.Linearization.prototype.makeBasicConnListItem_ = function(node, text) {
  if(!counter.makeBasicConnListItem_) counter.makeBasicConnListItem_ = [];
  counter.makeBasicConnListItem_.push(new Error(arguments).stack);

  var item = Blockly.Linearization.makeListTextItem_(text);
  var connection = node.getLocation();
  item.id = "li" + connection.id;
  item.blockId = connection.id;
  item.setAttribute('style', 'color:hsl(0, 0%, 0%)');
  item.addEventListener('click', e => this.moveItemOnclick_(node, e));
  return item;
}

/**
 * Creates and returns the color-coded, linked HTML bold text of a parent block
 * used in parent-nav.
 * @param {?Blockly.ASTNode} node a parent node. If null, creates the
 * workspace ParentItem.
 * @return {HTMLElement} an html representation of node as a parent
 * @private
 */
Blockly.Linearization.prototype.makeParentItem_ = function(node) {
  if(!counter.makeParentItem_) counter.makeParentItem_ = [];
  counter.makeParentItem_.push(new Error(arguments).stack);

  var item = document.createElement('b');
  var labelText = Blockly.Linearization.getNodeLabel(node);
  if (!node && !this.selectedNode) {
    // ***Requires Localization***
    labelText += this.blockJoiner.blockNode? ' (move mode)': ' (summary)';
  }
  item.appendChild(document.createTextNode(labelText + ' > '));
  if (node) {
    item.setAttribute('style',
          'color:hsl(' + node.getLocation().getHue() + ', 40%, 40%)');
  }
  // ***Requires Localization***
  item.setAttribute('aria-label', 'Jump to ' + labelText);
  item.addEventListener('click', e => this.listItemOnclick_(node));
  return item;
}

/**
 * Creates and returns the appropriately edittable HTML ListElement of node.
 * @param {!Blockly.ASTNode} node the input/field to represent
 * @return {HTMLElement} an edittable html representation of node
 * @private
 */
Blockly.Linearization.prototype.makeInputListItem_ = function(node) {
  if(!counter.makeInputListItem_) counter.makeInputListItem_ = [];
  counter.makeInputListItem_.push(new Error(arguments).stack);

  var location = node.getLocation();
  switch (node.getType()) {
    case Blockly.ASTNode.types.FIELD:
      if (location instanceof Blockly.FieldDropdown) {
        return this.makeDropdownItem_(location);
      }
      if (location instanceof Blockly.FieldNumber
          || location instanceof Blockly.FieldTextInput) {
        return this.makeEditableFieldItem_(location);
      }
      var fallthroughText = 'field but neither dropdown nor number';
      return Blockly.Linearization.makeListTextItem_(fallthroughText);
    case Blockly.ASTNode.types.INPUT:
      if (location.targetConnection) {
        var targetInputs = location.targetConnection.getSourceBlock().inputList;
        if (targetInputs.length === 1 &&
            (targetInputs[0].fieldRow[0] instanceof Blockly.FieldNumber)) {
          return this.makeEditableFieldItem_(targetInputs[0]);
        }
        var targetBlockNode = node.in().next();
        return this.makeBasicListItem_(targetBlockNode);
      }
      break;
    case Blockly.ASTNode.types.OUTPUT:
      break;
    default: // should never happen
      console.warn('uncaught', node);
  }
  return null;
}

/**
 * Returns an ordered Array of linked html list items that represent the
 * movement options of the node and the node itself
 * @param {!Blockly.ASTNode} node the node to represent
 * @return {Array<HTMLElement>} the html representation of node and its options
 * @private
 */
Blockly.Linearization.prototype.makeNodeListItems_ = function(node) {
  if(!counter.makeNodeListItems_) counter.makeNodeListItems_ = [];
  counter.makeNodeListItems_.push(new Error(arguments).stack);

  var list = [];

  var disp = this.blockJoiner.blockNode !== node && this.blockJoiner.blockNode;
  var prevConn = node.prev();
  var dispPrev = prevConn && !prevConn.prev();
  if (disp && dispPrev) {
    try {
      prevConn.getLocation().checkConnection_(
        this.blockJoiner.blockNode.next().getLocation());
      // ***Requires Localization***
      list.push(this.makeBasicConnListItem_(prevConn, 'Insert above'));
    } catch (e) { /* invalid connection point */ }
  }

  list.push(this.makeBasicListItem_(node));

  var nextConn = node.next();
  if (disp && nextConn) {
    try {
      nextConn.getLocation().checkConnection_(
        this.blockJoiner.blockNode.prev().getLocation());
      var last = !nextConn.next() ||
          nextConn.next().getType() !== Blockly.ASTNode.types.PREVIOUS;
      // ***Requires Localization***
      var text = last? 'Insert below': 'Insert between';
      list.push(this.makeBasicConnListItem_(node.next(), text));
    } catch (e) { /* invalid connection point */ }
  }

  return list;
}

/**
 * Returns an ordered Array of linked html list items that represent the
 * list of branches on the if block the node contain
 * @param {!Blockly.ASTNode} node the node containing an if block to represent
 * @return {Array<HTMLElement>} the html representation of node and its branches
 * @private
 */
Blockly.Linearization.prototype.makeIfListItems_ = function(node) {
  if(!counter.makeIfListItems_) counter.makeIfListItems_ = [];
  counter.makeIfListItems_.push(new Error(arguments).stack);

  const branches = node.branch? [node.branch]:
      Blockly.Linearization.getIfBranches(node);
  var list = [];

  if (node.branch && node.branch.condNode) {
    list.push(this.makeBasicListItem_(node.branch.condNode));
  }

  for (let branch of branches) {
    var text = branch.type;
    if (text !== 'else') {
      text += ' ';
      text += branch.condNode?
          branch.condNode.getLocation().makeAriaLabel():
          this.blankText_;
      // ***Requires Localization***
      text += ' do';
    }

    var bracketItem;
    try {
      var potential = this.blockJoiner.blockNode.prev();
      branch.condConnection.checkConnection_(potential.getLocation());
      // ***Requires Localization***
      var temp = Blockly.ASTNode.createConnectionNode(branch.condConnection);
      bracketItem = this.makeBasicConnListItem_(temp,
          text + ' (click to fill)');
    } catch(e) {
      bracketItem = this.makeBasicListItem_(node, branch);
      bracketItem.innerHTML = text;
    }

    var bracketItemList = document.createElement('ul');
    bracketItem.appendChild(bracketItemList);
    list.push(bracketItem);

    if (branch.bodyNode) {
      branch.bodyNode.sequence(n => n.getFirstSiblingBlock())
        .map(node => this.makeNodeListItems_(node))
        .forEach(items => bracketItemList.append(...items));
      continue;
    }

    if (this.blockJoiner.blockNode) {
      var body = Blockly.ASTNode.createConnectionNode(branch.bodyConnection);
      var listItem = this.makeBasicConnListItem_(body, 'Insert within ' + text);
      bracketItemList.appendChild(listItem);
      continue;
    }

    bracketItemList.appendChild(
      Blockly.Linearization.makeListTextItem_(this.blankText_));
  }

  if (node.branch) {
    var viewAllItem = this.makeBasicListItem_(node, null);
    // ***Requires Localization***
    viewAllItem.innerHTML = 'View all branches...';
    list.push(viewAllItem);
  }

  return list;
}

/**
 * Creates and returns the standard ListElement for the block in node, labelled
 * with text equivalent to node.getLocation().makeAriaLabel().
 * Attributes include a unique id and blockId for the associated block, as well
 * adding the standard listItemOnclick_(node, branch) event listener on click.
 * @param {!Blockly.ASTNode} node the block to represent
 * @param {?Object} branch the if branch to navigate to
 * @return {HTMLElement} an linked html list item representation of node
 * @private
 */
Blockly.Linearization.prototype.makeBasicListItem_ = function(node, branch) {
  if(!counter.makeBasicListItem_) counter.makeBasicListItem_ = [];
  counter.makeBasicListItem_.push(new Error(arguments).stack);

  var listElem = document.createElement('li');
  var block = node.getLocation();
  var text = block.makeAriaLabel();
  if (this.blockJoiner.blockIs(node)) {
    // ***Requires Localization***
    text += ' (moving me...)';
  }
  listElem.id = "li" + block.id;
  listElem.blockId = block.id;
  listElem.appendChild(document.createTextNode(text));
  listElem.addEventListener('click', e => this.listItemOnclick_(node, branch));
  listElem.setAttribute('style',
          'color:hsl(' + node.getLocation().getHue() + ', 40%, 40%)');
  return listElem;
}

/**
 * Creates and returns a textfield HTML li element linked to node's value.
 * @param {!Blockly.ASTNode} node the field or input to represent
 * @return {HTMLElement} an html list item that is edittable for number
 * and text fields.
 * @private
 */
Blockly.Linearization.prototype.makeEditableFieldItem_ = function(node) {
  if(!counter.makeEditableFieldItem_) counter.makeEditableFieldItem_ = [];
  counter.makeEditableFieldItem_.push(new Error(arguments).stack);

  var listElem;
  try {
    var field = node.fieldRow[0];
  } catch {
    var field = node;
  }
  if (field instanceof Blockly.FieldDropdown) {
    return this.makeDropdownItem_(field)
  }
  var fieldName = field.name;
  if (field.getText() === "") {
    // ***Requires Localization***
    listElem = Blockly.Linearization.makeListTextItem_('[Enter some text]');
  } else {
    listElem = Blockly.Linearization.makeListTextItem_(field.getText());
  }
  listElem.id = "li" + field.getSourceBlock().id;
  listElem.contentEditable = true;
  listElem.addEventListener('blur', function(event) {
    var block = workspace.getBlockById(listElem.id.slice(2));
    block.setFieldValue(listElem.innerText, fieldName);
  });
  listElem.addEventListener('keyup', (event) => {
    event.preventDefault();
    if (event.keyCode === 13) {
      var block = this.workspace.getBlockById(listElem.id.slice(2));
      block.setFieldValue(listElem.innerText, fieldName);
    }
  });
  return listElem;
}

/**
 * Returns the html list element representing field, null if an invalid field
 * @param {!Blockly.FieldDropdown} field the field to represent
 * @return {?HTMLElement} a clickable representation of the field that toggles
 * options through the dropdown option list. If there are no options, null.
 */
Blockly.Linearization.prototype.makeDropdownItem_ = function(field) {
  if(!counter.makeDropdownItem_) counter.makeDropdownItem_ = [];
  counter.makeDropdownItem_.push(new Error(arguments).stack);

  var options = field.getOptions();
  if (!options.length) {
    return null;
  }


  const makeOptObj = (option) => ({label: option[0], value: option[1]});
  const makeEntryObj = (i) => ({i: i, option: makeOptObj(options[i])});

  var entry = makeEntryObj(0);
  for (var i = 0, option; option = options[i]; i++) {
    if (option[1] === field.getValue()) {
      entry = makeEntryObj(i);
      break;
    }
  }

  var labelText = 'Field: ' + entry.option.label;
  var elem = Blockly.Linearization.makeListTextItem_(labelText);
  // ***Requires Localization***
  elem.setAttribute('aria-label', labelText + ', click to change');
  elem.setAttribute('index', entry.i);
  elem.addEventListener('click', e => {
    Blockly.Events.disable();
    const oldIndex = parseInt(elem.getAttribute('index'));
    var offset = 1;
    while (offset < field.getOptions().length) {
      var newIndex = (oldIndex + offset) % field.getOptions().length;
      var option = makeOptObj(field.getOptions()[newIndex]);
      var newLabelText = 'Field: ' + option.label;
      var textNode = document.createTextNode(newLabelText);
      // ***Requires Localization***
      elem.setAttribute('aria-label', newLabelText + ', click to change');
      elem.setAttribute('index', newIndex);

      try {
        field.setValue(option.value);
        elem.replaceChild(textNode, elem.firstChild);
        break;
      } catch (e) { // not a variable, so value can't be set
        console.warn('not a valid variable', option);
      } finally {
        offset++;
      }
    }
    this.generateParentNav_(this.selectedNode);
    Blockly.Events.enable();
  });
  return elem;
}

/**
 * Creates and returns a linked HTML li element linked to node's direct visual
 * parent.
 * @param {!Blockly.ASTNode} node the child node of the parent to go back to
 * @return {HTMLElement} an html list item that will navigate to the direct
 * visual parent block
 */
Blockly.Linearization.prototype.makeGoBackItem_ = function(node) {
  if(!counter.makeGoBackItem_) counter.makeGoBackItem_ = [];
  counter.makeGoBackItem_.push(new Error(arguments).stack);

  var returnNode = document.createElement('li');
  var outNode = node.out();
  while (outNode && outNode.getType() !== 'block') {
    outNode = outNode.out();
  }
  // ***Requires Localization***
  var labelText = 'Go back to ' + Blockly.Linearization.getNodeLabel(outNode);
  returnNode.appendChild(document.createTextNode(labelText));
  returnNode.addEventListener('click', e => this.listItemOnclick_(outNode));
  return returnNode;
}

/**
 * Creates and returns a linked HTML li element linked to a function w/return
 * node's return value block
 * @param {!Blockly.ASTNode} rootNode the node that contains the function block
 * @param {!Blockly.ASTNode} inNode
 * @return {HTMLElement} an html list item that will navigate to the return
 * value of the block
 */
Blockly.Linearization.prototype.makeReturnItem_ = function(rootNode) {
  if(!counter.makeReturnItem_) counter.makeReturnItem_ = [];
  counter.makeReturnItem_.push(new Error(arguments).stack);

  var inNode = rootNode.in();
  while (inNode && inNode.getType() !== Blockly.ASTNode.types.INPUT) {
    inNode = inNode.next();
  }
  var returnNode = inNode.sequence(n => n.next()).find(n =>
    n.getLocation().getParentInput() &&
    n.getLocation().getParentInput().type === 1);
  if (returnNode.in() && returnNode.in().next()) {
    var returnBlock = returnNode.in().next();
    var returnListItem = this.makeBasicListItem_(returnBlock);
    // ***Requires Localization***
    returnListItem.innerHTML = 'return ' + returnListItem.innerHTML;
    return returnListItem;
  }

  if (this.blockJoiner.blockNode) {
    try {
      returnNode.getLocation().checkConnection_(
        this.blockJoiner.blockNode.prev().getLocation());
      // ***Requires Localization***
      return this.makeBasicConnListItem_(returnNode, 'Insert in return');
    } catch (e) { /* invalid connection point */ }
  }

  // ***Requires Localization***
  return Blockly.Linearization.makeListTextItem_('return ' + this.blankText_);
}

/**
 * Creates and returns an li element that pushes the node to this.blockJoiner
 * on click
 * @param {!Blockly.ASTNode} node the node to be moved on click
 * @return {HTMLElement} a labeled html list item that will fire
 * this.moveItemOnclick_(node) when clicked.
 */
Blockly.Linearization.prototype.makeMoveItem_ = function(node) {
  if(!counter.makeMoveItem_) counter.makeMoveItem_ = [];
  counter.makeMoveItem_.push(new Error(arguments).stack);

  // ***Requires Localization***
  var text = this.blockJoiner.blockNode? 'Move me instead': 'Move me';
  var element = Blockly.Linearization.makeListTextItem_(text);
  element.addEventListener('click', e => this.moveItemOnclick_(node, e));
  return element;
}

/**
 * Pushes the node to this.blockJoiner, and navigates to the workspace level
 * linearization
 * @param {!Blockly.ASTNode} node the node to be pushed
 * @private
 */
Blockly.Linearization.prototype.moveItemOnclick_ = function(node, e) {
  if(!counter.moveItemOnclick) counter.moveItemOnclick = [];
  counter.moveItemOnclick.push(new Error(arguments).stack);

  try {
    var successfulConnection = this.blockJoiner.push(node);
    // can fail and not throw an exception
    if (successfulConnection) {
      this.selectedNode = null;
      this.generateList_();
    }
  } catch (e) {
    console.warn('Unsuccessful push', e);
  }
}

/**
 * The standard onclick action for ListElements. Highlights the node's block if
 * node is not null, sets the selectedNode to node, and calls generateList_().
 * @param {?Blockly.ASTNode} node the node to navigate to and highlight
 * @param {?Object} branch the if-branch to display
 * @private
 */
Blockly.Linearization.prototype.listItemOnclick_ = function(node, branch) {
  if(!counter.listItemOnclick) counter.listItemOnclick = [];
  counter.listItemOnclick.push(new Error(arguments).stack);

  this.highlightBlock(node && node.getLocation());
  this.selectedNode = node;
  if (node) {
    this.selectedNode.branch = branch;
  }
  this.generateList_();
}

/**
 * Highlights block if block is not null. Sets lastHighlighted to block.
 * @param {?Blockly.ASTNode} block block to highlight, null if none
 */
Blockly.Linearization.prototype.highlightBlock = function(block) {
  if(!counter.highlightBlock) counter.highlightBlock = [];
  counter.highlightBlock.push(new Error(arguments).stack);

  this.clearHighlighted();
  if (block) {
    block.setHighlighted(true);
  }
  this.lastHighlighted = block;
}

/**
 * Unhighlights lastHighlighted, if lastHighlighted is not null.
 */
Blockly.Linearization.prototype.clearHighlighted = function() {
  if(!counter.clearHighlighted) counter.clearHighlighted = [];
  counter.clearHighlighted.push(new Error(arguments).stack);

  if (this.lastHighlighted) {
    this.lastHighlighted.setHighlighted(false);
  }
}

/**
 * Creates and returns an HTML li element with a text node reading text.
 * @param {!String} text the text on the list item
 * @return {HTMLElement} an html list item with text node text
 * @private
 */
Blockly.Linearization.makeListTextItem_ = function(text) {
  if(!counter.makeListTextItem_) counter.makeListTextItem_ = [];
  counter.makeListTextItem_.push(new Error(arguments).stack);

  var listElem = document.createElement('li');
  listElem.appendChild(document.createTextNode(text));
  return listElem;
}

/**
 * Creates and returns the next label in lexicographic order, adding a letter in
 * the event of overflow.
 * @param {!String} marker the last node created
 * @return {String} the next label after marker in lexicographic order
 */
Blockly.Linearization.nextStackMarker = function(marker) {
  if(!counter.nextStackMarker) counter.nextStackMarker = [];
  counter.nextStackMarker.push(new Error(arguments).stack);

  var lastIndex = marker.length - 1;
  var prefix = marker.slice(0, lastIndex);
  if (marker.charCodeAt(lastIndex) === 'Z'.charCodeAt(0)) {
    return (prefix? this.nextStackMarker(prefix): 'A') + 'A';
  }
  return prefix + String.fromCharCode(marker.charCodeAt(lastIndex) + 1);
}

/**
 * Creates and returns the aria label for node if
 * node.getLocation().makeAriaLabel is not null, 'workspace' if otherwise.
 * @param {?Blockly.ASTNode} node the node to get aria-label from
 * @return {String} the string generated by node.getLocation().makeAriaLabel()
 */
Blockly.Linearization.getNodeLabel = function(node) {
  if(!counter.getNodeLabel) counter.getNodeLabel = [];
  counter.getNodeLabel.push(new Error(arguments).stack);

  // ***Requires Localization***
  return node && node.getLocation().makeAriaLabel?
      node.getLocation().makeAriaLabel(): 'workspace';
}

/**
 * Seeks the next inline input on node's AST parent after node itself.
 * @param {!Blockly.ASTNode} node the last sibiling searched
 * @return {Blockly.ASTNode} the first inline sibling after node, null if none.
 */
Blockly.Linearization.nextInlineInput = function(node) {
  if(!counter.nextInlineInput) counter.nextInlineInput = [];
  counter.nextInlineInput.push(new Error(arguments).stack);

  var next = node.next();
  if (next && next.getType() === Blockly.ASTNode.types.FIELD) {
    return next;
  }
  if (next && next.in() &&
     next.in().getType() != Blockly.ASTNode.types.PREVIOUS) {
    return next;
  }
  return null;
}

/**
 * Returns the list of first children in the body of each branch of the if,
 * in the order they appear on the if block
 * @param {!Blockly.ASTNode} ifNode the node containing the if block
 * @return {Array<Blockly.ASTNode>} the list of children in each do block
 * from the top of the block to the bottom
 */
Blockly.Linearization.getIfChildrenNodes_ = function(ifNode) {
  if(!counter.getIfChildrenNodes_) counter.getIfChildrenNodes_ = [];
  counter.getIfChildrenNodes_.push(new Error(arguments).stack);

  return Blockly.Linearization.getIfBranches(ifNode).map(n => n.bodyNode);
}

/**
 * Returns the list of objects representing each branch of the if in order
 * @param {!Blockly.ASTNode} ifNode the node containing the if block
 * @return {Array<Object>} the list of branches
 */
Blockly.Linearization.getIfBranches = function(ifNode) {
  if(!counter.getIfBranches) counter.getIfBranches = [];
  counter.getIfBranches.push(new Error(arguments).stack);

  const children = ifNode.in().sequence(n => n.next());
  var branches = [];
  for (var i = 0; i < children.length; i += 2) {
    var branch = {key: i / 2};
    if (i === children.length - 1) {
      // ***Requires Localization***
      branch.type = 'else';
      branch.bodyIndex = i;
    } else {
      // ***Requires Localization***
      branch.type = i? 'else if': 'if';

      branch.condIndex = i;
      branch.condConnection = children[i].getLocation();
      var condItem = children[i] && children[i].in();
      branch.condNode = condItem && condItem.next();

      branch.bodyIndex = i + 1;
    }

    branch.bodyConnection = children[branch.bodyIndex].getLocation();
    var bodyItem = children[branch.bodyIndex].in();
    branch.bodyNode = bodyItem && bodyItem.next();

    branches.push(branch);
  }

  return branches;
}
