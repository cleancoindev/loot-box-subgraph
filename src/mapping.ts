import { BigInt, log , Address} from "@graphprotocol/graph-ts"
import {
  ERC721ControlledCreated, ERC721ControlledFactory
} from "../generated/ERC721ControlledFactory/ERC721ControlledFactory"

import {ERC20, Transfer} from "../generated/ERC20/ERC20"
import {Transfer as ERC721Transfer, ERC721 as ERC721Contract} from "../generated/ERC721/ERC721"

import { ERC20Balance, Lootbox, ERC20 as ERC20Entity, ERC721 , ERC721Token, ERC1155 as ERC1155Entity, ERC1155Balance} from "../generated/schema"

import {ERC721Controlled as ERC721ControlledTemplate } from "../generated/templates"
import { LootboxController } from "../generated/templates/ERC721Controlled/LootboxController"
import {TransferBatch, TransferSingle, ERC1155} from "../generated/ERC1155/ERC1155"

const LOOTBOX_CONTROLLER_ADDRESS : string = "0xF8819cB0e8aEB3FF451888512cB8f741378cc475"


export function handleERC721ControlledCreated(event: ERC721ControlledCreated): void {
  ERC721ControlledTemplate.create(event.params.param0)  // instantiate the ERC721Controlled template
}


// global "external" erc20 transfer
export function handleERC20Transfer(event: Transfer) : void { 
  // get to and from fields from event
  const to = event.params.to
  const from = event.params.from
  const amount = event.params.value
  const erc20Address = event.address

  // if erc20 does not exist in store - create it 
  if(ERC20Entity.load(erc20Address.toHex()) == null){
    let erc20Contract = ERC20.bind(erc20Address)
    let erc20 = new ERC20Entity(erc20Address.toHex())
    erc20.name = erc20Contract.try_name().value
    erc20.symbol = erc20Contract.try_symbol().value
    erc20.decimals = BigInt.fromI32(erc20Contract.try_decimals().value)
    erc20.save()
  }

  // load lootbox entity corresponding to the to/from address
  const lootboxTo = Lootbox.load(to.toHex())
  
  // if erc20 transfer is TO the lootbox address we increment the balance of the lootbox
  if(lootboxTo != null) {   
    let erc20balance = ERC20Balance.load(generateCompositeId(lootboxTo.id , erc20Address.toHex())) 
    if(erc20balance == null) { // create ERC20Balance 
      erc20balance = new ERC20Balance(generateCompositeId(lootboxTo.id , erc20Address.toHex()))
      erc20balance.balance = amount
      erc20balance.token = erc20Address.toHex()
      erc20balance.address = lootboxTo.id //Lootbox? is this correct
      erc20balance.save()
    }
    else { // update case
      const existingErc20balance = erc20balance.balance
      erc20balance.balance = existingErc20balance.plus(amount)
      erc20balance.save()
    }
    lootboxTo.save()
  }


  // erc20 transfer FROM lootbox decrement balance
  let lootboxFrom = Lootbox.load(from.toHex())
  if(lootboxFrom != null) {
    // if its a ERC20 transfer from the Lootbox to an outside address then the ERC20 should exist
    let erc20 = ERC20Entity.load(erc20Address.toHex())
    let erc20balance = ERC20Balance.load(generateCompositeId(erc20.id,lootboxFrom.id))
    if(erc20 == null || erc20balance == null) {
      log.error("ERC20 should already exist", [])
      return;
    }
    const existingBalance = erc20balance.balance
    if(amount > existingBalance){
      log.error("Decrement amount greater than balance!", [])
    }
    else{
      erc20balance.balance = existingBalance.minus(amount)
    }
    lootboxFrom.save()
  }
}




// global "external" erc721 Transfer event
export function handleERC721Transfer(event: ERC721Transfer) : void {
  // get to and from fields from event
  const to = event.params.to
  const from = event.params.from
  const tokenId = event.params.tokenId

  const erc721Address = event.address

  // load ERC721 entity
  let erc721 = ERC721.load(erc721Address.toHex())
  if(erc721 == null){ // we need to create  this entity
    erc721 = new ERC721(erc721Address.toHex())
    const erc721Contract = ERC721Contract.bind(erc721Address)
    erc721.name = erc721Contract.try_name().value
    erc721.uri = erc721Contract.try_baseURI().value
    erc721.save()
  }
  
  // erc721 transferred INTO lootbox
  let lootboxTo = Lootbox.load(to.toHex())
  if(lootboxTo != null) { // add erc721 to ERC721 collection
    let erc721token = ERC721Token.load(generateCompositeId(erc721.id,lootboxTo.id))
    if(erc721token == null ) {
      const newId = generateCompositeId(erc721.id, lootboxTo.id)
      erc721token = new ERC721Token(generateCompositeId(erc721.id, lootboxTo.id))
      erc721token.tokenId = tokenId
      erc721token.token =  erc721.id
      erc721token.owner = to.toHex()
      erc721token.save()
    }
    else {
      erc721token.owner = to.toHex()
      erc721token.save()
    }   
    lootboxTo.save() 
  }

  // case where ERC721 is transfered OUT of lootbox
  let lootboxFrom = Lootbox.load(from.toHex())
  if(lootboxFrom != null) {
    let erc721token = ERC721Token.load(generateCompositeId(erc721.id,lootboxTo.id))
    if(erc721token == null){
      log.error("This ERC721 was not in the lootbox! ", [])
      return // is this the right thing to do here?
    }
    else {
      erc721token.owner = to.toHex()
    }
    erc721token.save()
    lootboxFrom.save()
  }
}

// called when ERC721Controlled.mint() is called - counterfactually creating a Lootbox
export function handleMint(event : ERC721Transfer) : void {
  log.warning("entered handleMint handler for tx ", [event.transaction.hash.toHex()])
  // when this function is called a new Lootbox is "created"
  const tokenId : BigInt = event.params.tokenId
  const toAddress = event.params.to 

  // calculate the counterfactual address of the Lootbox
  let lootboxControllerContract = LootboxController.bind(Address.fromString(LOOTBOX_CONTROLLER_ADDRESS))
  const lootBoxAddress = lootboxControllerContract.try_computeAddress(toAddress, tokenId).value

  // construct a new lootbox entity with id = address calculated
  let lootbox = new Lootbox(lootBoxAddress.toHex())
  lootbox.tokenId = tokenId
  lootbox.erc721 = toAddress
  lootbox.save()
}


// global "external" erc1155 TransferSingle event
export function handleTransferSingle(event: TransferSingle) : void {
  //extract data fields from event
  const operator = event.params.operator // what do we do with the operator field? do we need it?
  const from = event.params.from
  const to = event.params.to
  const tokenId = event.params.id
  const value = event.params.value
  
  const erc1155Address = event.address

  // check if ERC1155 entity exists, if null create
  let erc1155 = ERC1155Entity.load(erc1155Address.toHex())
  if(erc1155 == null) { 
    erc1155 = new ERC1155Entity(erc1155Address.toHex())
    //const erc1155Contract = ERC1155.bind(erc1155Address) // we dont need to call anything on erc1155's -- no meta info?
    erc1155.save()
  }

  const lootboxTo = Lootbox.load(to.toHex())
  // case where ERC1155 is transferred TO the lootbox
  if(lootboxTo != null) { //add value to balance
    let erc1155Balance = ERC1155Balance.load(generateCompositeERC1155Id(erc1155.id, tokenId, lootboxTo.id))
    if(erc1155Balance == null){ // we need to create an ERC1155Balance entity
      erc1155Balance = new ERC1155Balance(generateCompositeERC1155Id(erc1155.id, tokenId, lootboxTo.id))
      erc1155Balance.tokenId = tokenId
      erc1155Balance.balance = value
      erc1155Balance.token = erc1155Address.toHex() // ??
      erc1155Balance.address = [lootboxTo.id] // ??
      erc1155Balance.save()
    }
    else { // already exists - update
      const existingBalance = erc1155Balance.balance
      erc1155Balance.balance = existingBalance.plus(value)
      erc1155Balance.save()
    }
    lootboxTo.save()
  }
  // check against FROM field
  const lootboxFrom = Lootbox.load(from.toHex())
  if(lootboxFrom != null) { // // reduce from balance
    let erc1155Balance = ERC1155Balance.load(generateCompositeERC1155Id(erc1155.id, tokenId, lootboxFrom.id))
    if(erc1155Balance == null){ // we need to create an ERC1155Balance entity
      log.error("ERC1155 token was not in lootbox!", [])
    }
    else {
      const existingBalance = erc1155Balance.balance
      erc1155Balance.balance = existingBalance.minus(value)
      erc1155Balance.save()
    }
    lootboxTo.save()
  }
}


// global "external" erc1155 TransferBatch event
export function handleTransferBatch(event : TransferBatch) : void {
  const operator = event.params.operator // again, do we need this?
  const from = event.params.from
  const to = event.params.to
  const tokenIds = event.params.ids
  const values= event.params.values

  const erc1155Address = event.address

  // check against TO field
  const lootboxTo = Lootbox.load(to.toHex())
  if(lootboxTo != null) {
    let erc1155 = ERC1155Entity.load(erc1155Address.toHex())
    if(erc1155 == null) { 
      let erc1155 = new ERC1155Entity(erc1155Address.toHex())
      //const erc1155Contract = ERC1155.bind(erc1155Address) // we dont need to call anything on erc1155's -- no meta info?
      erc1155.save()
    }

    const batchSize = new BigInt(values.length)
    let index: BigInt = new BigInt(0)
    for(index; index.lt(batchSize); index.plus(new BigInt(1))){
      // check if ERC1155 entity exists, if null create
      let erc1155Balance = ERC1155Balance.load(generateCompositeERC1155Id(erc1155.id, tokenIds[index.toI32()], lootboxTo.id))
      if(erc1155Balance == null) {
        erc1155Balance = new ERC1155Balance(generateCompositeERC1155Id(erc1155.id, tokenIds[index.toI32()], lootboxTo.id))
        erc1155Balance.tokenId = tokenIds[index.toI32()]
        erc1155Balance.balance = values[index.toI32()]
        erc1155Balance.token = erc1155Address.toHex()
        erc1155Balance.address = [lootboxTo.id]
        erc1155Balance.save()
      }
      else {
        const existingBalance = erc1155Balance.balance
        erc1155Balance.balance = existingBalance.plus(values[index.toI32()])
        erc1155Balance.save()
      }
      lootboxTo.save()
    }
  }
  
  // check against FROM field
  const lootboxFrom = Lootbox.load(from.toHex())

  if(lootboxTo != null) {
    let erc1155 = ERC1155Entity.load(erc1155Address.toHex())
    if(erc1155 == null) { 
      erc1155 = new ERC1155Entity(erc1155Address.toHex())
      //const erc1155Contract = ERC1155.bind(erc1155Address) // we dont need to call anything on erc1155's -- no meta info?
      erc1155.save()
    }
    // reduce the balance of each of these from the array
    const batchSize = new BigInt(values.length)
    let index: BigInt = new BigInt(0)
    for(index; index.lt(batchSize); index.plus(new BigInt(1))){
    let erc1155Balance = ERC1155Balance.load(generateCompositeERC1155Id(erc1155.id, tokenIds[index.toI32()], lootboxFrom.id))
    if(erc1155Balance == null){
      log.error("ERC1155 token does not exist in lootbox ", [])
      return
    }
    else {
      const existingBalance = erc1155Balance.balance
      erc1155Balance.balance = existingBalance.minus(values[index.toI32()])
      erc1155Balance.save()
    }
    lootboxFrom.save()
    } 
  }
}

export function handlePlundered() : void {
  // noop- do we need this?
}

// helper functions
function generateCompositeId(ercId: string , lootboxId : string) : string{
  return ercId + lootboxId
}
function generateCompositeERC1155Id(ercId: string, tokenId: BigInt, lootboxId: string): string {
  return ercId + tokenId.toHex() + lootboxId
}