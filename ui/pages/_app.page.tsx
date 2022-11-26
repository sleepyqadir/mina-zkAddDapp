import '../styles/globals.css'
import { useEffect, useState } from "react";
import './reactCOIServiceWorker';
import 'bootstrap/dist/css/bootstrap.css'
import ZkappWorkerClient from './zkappWorkerClient';
import {
  PublicKey,
  PrivateKey,
  Field,
} from 'snarkyjs'
let transactionFee = 0.1;

export default function App() {

  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
  });

  useEffect(() => {

    (async () => {

      if (!state.hasBeenSetup) {
        const zkappWorkerClient = new ZkappWorkerClient();

        console.log("Loading SnarkyJs...")

        await zkappWorkerClient.loadSnarkyJS()

        console.log("Done");

        await zkappWorkerClient.setActiveInstanceToBerkeley()

        const mina = (window as any).mina;

        if (mina == null) {
          setState({ ...state, hasWallet: false })
          return;
        }

        const publicKeyBase58: string = (await mina.requestAccounts())[0]

        const publicKey = PublicKey.fromBase58(publicKeyBase58)

        console.log("using key", publicKey.toBase58())

        console.log("checking if account exists", publicKey)

        const res = await zkappWorkerClient.fetchAccount({ publicKey: publicKey! })

        const accountExists = res.error == null ? true : false

        await zkappWorkerClient.loadContract()

        console.log("compiling zkApp");

        await zkappWorkerClient.compileContract();

        console.log("zkApp compiled successfully")

        const zkappPublicKey = PublicKey.fromBase58('B62qpDm2mvCfrp8a6CUnLTUMVzpsFf4qfmf7nQwsVHM13Pm9KndsViX');

        await zkappWorkerClient.initZkappInstance(zkappPublicKey);

        console.log("getting zkapp state");


        await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey })

        const currentNumber = await zkappWorkerClient.getNum();

        console.log("current number", currentNumber.toString());


        console.log('current state:', currentNumber.toString());
        setState({
          ...state,
          zkappWorkerClient,
          hasWallet: true,
          hasBeenSetup: true,
          publicKey,
          zkappPublicKey,
          accountExists,
          currentNum: currentNumber
        });

      }

    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (; ;) {
          console.log("checking if account exists");

          const res = await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! })

          const accountExists = await res.error == null

          if (accountExists) {
            break
          }

          await new Promise((resolve, reject) => {
            setTimeout(resolve, 5000);
          })

        }
        setState({
          ...state,
          accountExists: true
        })
      }
    })()
  }, [state.hasBeenSetup])

  const onSendTransaction = async () => {
    setState({ ...state, creatingTransaction: true })
    console.log("creating transaction");

    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! })

    await state.zkappWorkerClient?.createUpdateTransaction()

    console.log("creating prooof");

    await state.zkappWorkerClient!.proveUpdateTransaction()

    console.log("getting transaction JSON");

    const transactionJson = await state.zkappWorkerClient!.getTransactionJSON()

    console.log("requesting send transaction JSON");

    const { hash } = await (window as any).mina.sendTransaction({
      transaction: transactionJson,
      feePayer: {
        fee: transactionFee,
        memo: ""
      }
    });

    console.log(
      'See transaction at https://berkeley.minaexplorer.com/transaction/' + hash
    );

    setState({
      ...state,
      creatingTransaction: false
    })
  }

  const onRefreshCurrentNumber = async () => {
    console.log("getting zkApp instance..")

    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! })

    const currentNumber = await state.zkappWorkerClient!.getNum()

    console.log("current number: " + currentNumber)

    setState({
      ...state,
      currentNum: currentNumber
    })

  }


  // -------------------------------------------------------
  // Create UI elements
  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = 'https://www.aurowallet.com/';
    const auroLinkElem = <a href={auroLink} target="_blank" rel="noreferrer"> [Link] </a>
    hasWallet = <div> Could not find a wallet. Install Auro wallet here: {auroLinkElem}</div>
  }
  let setupText = state.hasBeenSetup ? 'SnarkyJS Ready' : 'Setting up SnarkyJS...';
  let setup = <div> {setupText} {hasWallet}</div>
  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink = "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
    accountDoesNotExist = <div>
      Account does not exist. Please visit the faucet to fund this account
      <a href={faucetLink} target="_blank" rel="noreferrer"> [Link] </a>
    </div>
  }
  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = <div >
      <button type="button" className='btn btn-primary' onClick={onSendTransaction} disabled={state.creatingTransaction}> Send Transaction </button>
      <h1 style={{ margin: "10px" }}> Current Number in zkApp: {state.currentNum!.toString()} </h1>
      <button type="button" className='btn btn-primary' onClick={onRefreshCurrentNumber}> Get Latest State </button>
    </div>
  }
  return <div className="container">
    <div className="row">
      <div className="col">
      </div>
      <div className="col-5">
        <h1 style={{ margin: "10px" }}>   {setup} </h1>
        {accountDoesNotExist}
        {mainContent}
      </div>
      <div className="col">
      </div>
    </div>

  </div>
}