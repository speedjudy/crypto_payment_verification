import './App.css';
import { useEffect, useState } from 'react';
import QRCode from "react-qr-code";
import axios from 'axios';
import Web3 from 'web3';
import erc20ABI from "./erc20.json";
import abiDecoder from "abi-decoder";
import { COINS_FOR_PAYMENT } from './config';

function App()
{  
  const [selectedNet, setSelectedNetwork] = useState("Bitcoin");
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState("BTC");
  const [selectedCoinAddress, setSelectedCoinAddress] = useState("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const [selectedReceiptWallet, setSelectedReceiptWallet] = useState("3NatrB4PxupbgCB4NKCmBrrLtt5H8mXz6j");
  const [selectedPaymentAmount, setSelectedPaymentAmount] = useState(0.0001);  
  const [trxHash, setTrxHash] = useState("");
  const [paidCheck, setPaidCheck] = useState(false);
  const ETHEREUM_RPC_URL = "https://eth.llamarpc.com";

  const verifyTransaction = async () => 
  {
    if(selectedNet === "Ethereum" && trxHash.toString().length !== 66)
    {
      alert("Invalid transaction hash!"); return;
    }
    if(selectedNet === "Bitcoin" && trxHash.toString().length !== 64)
    {
      alert("Invalid transaction hash!"); return;
    }
    if(paidCheck === false)
    {
      alert("Please input hash and active checkbox."); return;  
    }
    if(selectedNet === "Ethereum")
    {
        if(selectedCoinSymbol === "ETH")
        {
          const GET_TX_STATUS = `https://deep-index.moralis.io/api/v2/transaction/${trxHash}`;
          let txStatusFromMoralis = await axios.get(GET_TX_STATUS,
            {
              headers: {
                'x-api-key': "E6R13cn5GmpRzCNwefYdeHPAbZlV69kIk9vp0rfhhajligQES1WwpWAKxqr7X2J3"   // Insert your Moralis API at here
              }
            }
          );
          console.log("txStatusFromMoralis  ===> ", txStatusFromMoralis);
          const txData = txStatusFromMoralis.data;    //get raw transaction data from axios response
          console.log("txData  ===> ", txData);
          if(txData.to_address.toString().toLowerCase() === selectedReceiptWallet.toString().toLowerCase())   //if this transaction was not sent to the receipent, then quit
          {
            var ethWeb3 = new Web3(ETHEREUM_RPC_URL);    //Create a Web3 object for Ethereum network
            var ethValue = Number(ethWeb3.utils.fromWei(txData.value.toString(), "ether").toString());  //Calculate the amount of tranfered ETHs, it convert the BigNumber with ETH decimal 18 to a normal number that have decimal 1
            if(ethValue >= selectedPaymentAmount) //if the transfered amount is less then standard payment amount , then quit
            {
              alert(`Success! We got ${ethValue} ETH.`); return;
            }
            else {alert("Invalid transaction"); return;}
          }
          else {
            alert("Invalid transaction"); return;
          }
        }
        else {
          try
          {
            const GET_TX_STATUS = `https://deep-index.moralis.io/api/v2/transaction/${trxHash}`;
            let txStatusFromMoralis = await axios.get(GET_TX_STATUS,
              {
                headers: {
                  'x-api-key': "E6R13cn5GmpRzCNwefYdeHPAbZlV69kIk9vp0rfhhajligQES1WwpWAKxqr7X2J3"  // Insert your Moralis API at here
                }
              }
            );
            console.log("txStatusFromMoralis  ===> ", txStatusFromMoralis);
            const txData = txStatusFromMoralis.data;
            console.log("txData  ===> ", txData);
            if(txData.to_address.toString().toLowerCase() === selectedCoinAddress.toString().toLowerCase())   // If this tx is not made to the payment coin smart contract, then quit
            {
              var ethWeb3 = new Web3(ETHEREUM_RPC_URL);   //create a WEb3 object for Ethereum network
              var tokenContract = new ethWeb3.eth.Contract(erc20ABI, selectedCoinAddress);   // Create token smart contract
              var decimals = await tokenContract.methods.decimals().call();   // get the dicimal number from token smart contact
              console.log("decimals  ===> ", decimals);
              abiDecoder.addABI(erc20ABI);   // We get help of ABI DECODER to parse raw transaction data, ABI of smart contract is a JSON file that has all public function | props definitions
              var input  =  txData["input"];
              let decodedData = abiDecoder.decodeMethod(input);  // fetch the input data from transaction, this data represent what function of token smart contract is excuted and what are the args
              console.log("decodedData ===> ", decodedData);
              //check function name
              if(decodedData["name"] == "transfer")  // if the function is the "tranfer", then quit
              {
                let params = decodedData.params;
                console.log("params ===> ", params);  //fetch arguments passed to the function
                if(params["0"]["value"].toString().toLowerCase() == selectedReceiptWallet.toString().toLowerCase()) // the first arg should equal to receipent wallet, if not quit
                {
                  var transferedAmount = params["1"]["value"];  // the first arg should represnet transfered token amount
                  transferedAmount = (new ethWeb3.utils.toBN(transferedAmount)).div(new ethWeb3.utils.toBN(10**decimals));  // convert the bit number to normal number
                  console.log("transferedAmount ===> ", transferedAmount.toString());
                  if(Number(transferedAmount.toString()) >= selectedPaymentAmount)  // compair the amount
                  {
                    alert(`Succeed! We got ${transferedAmount.toString()} USDC.`);
                  }
                  else {
                    alert("Insufficient receipted amount!"); return;                  
                  }
                }
                else {alert("Invalid transaction"); return;}
              }else {alert("Invalid transaction"); return;}
            }
            else {
              alert("Invalid transaction"); return;
            }
          }
          catch(error){
            alert("On Moralis.io tx data fetching : " + error.message.toString());
          }
        }
    }
    else{
      console.log("trxHash ===> ", trxHash);
      const GET_TRX_IN_BINARY_FORM = `https://blockchain.info/rawtx/${trxHash}`;
      await axios.get(GET_TRX_IN_BINARY_FORM)
      .then((blockchaincomResponse) => {
        console.log("blockchaincomResponse ===> ", blockchaincomResponse);   //parse bitcoin transaction, bitcoin transaction includes in and out sub transaxtions
        let out = blockchaincomResponse.data.out || [];  // payment to a certain transation will be a out subtx in a certain tx, so we fetch out part from raw tx data
        if(out.length > 0)  // if the tx doesn't have any out subtx, then quit
        {
          //find transaction sent certain amount to me
          let index = out.findIndex(item => item.addr == selectedReceiptWallet);  // find out subtx to the receipent wallet
          if(index < 0)  // if can not find, then quit
          { alert("Invalid transaction!"); return; }
          else {   //if found, parse amount
            let value = out.find(item => item.addr == selectedReceiptWallet).value;    //get amount transfered to receipent wallet 
            console.log("Paid amount to you ==> ", Number(value))
            if(Number(value) / 1e8 >= selectedPaymentAmount)   //compare the amount , before that we devide tx amount to decimal of BTC - 8
            {
              alert(`Succeed! We got ${Number(value) / 1e8} Bitcoin.`); return;
            }
            else {
              alert("Insufficient receipted amount!"); return;
            }
          }
        }else {
          alert("Invalid transaction!"); return;
        }
      })
      .catch((error) => 
      {
        alert("On Blockchain.com verification : " + error.message);
      });
    }
  }

  const onSelectCoin = (symbol) => {
    let coinData = COINS_FOR_PAYMENT.find(item => item.symbol === symbol);
    if(coinData !== null && coinData !== undefined)
    {
      setSelectedCoinSymbol(coinData.symbol);
      setSelectedCoinAddress(coinData.address);
      setSelectedNetwork(coinData.network);
      setSelectedPaymentAmount(coinData.paymentAmount);
      setSelectedReceiptWallet(coinData.receipentAddress);
    }
  }

  return (
    <div className="App flex align-center justify-center" >
      <div className='payment-area w-full flex flex-col items-center'>
        <h1 className="text-3xl font-bold text-transform: uppercase mt-[100px]">
          Crypto Payment
        </h1>
        <div className='border-4 mt-2 md:w-4/12 sm:w-10/12' >
          <div>
            Please select a network: 
            <select name="networkSelect border-2" onChange={(e) => { onSelectCoin(e.target.value)}} >
              {
                COINS_FOR_PAYMENT.map((item, index) => (
                  <option value={item.symbol} key={index} >{item.symbol}</option>
                ))                
              }
            </select>
          </div>
          <div className='mt-2'>
            Please Make Payment of <b>{selectedPaymentAmount} {selectedCoinSymbol}</b><br></br>
            <input className='mt-2 w-10/12 text-center border-2 '
              value={selectedReceiptWallet}
              disabled={true}
            />
            <span className="ml-1 border-2 text-md text-blue cursor-pointer"
              onClick={() => navigator.clipboard.writeText(selectedReceiptWallet)} 
            >
              Copy
            </span>            
          </div>
          <div className='p-4 flex justify-center' >
              <QRCode value={selectedReceiptWallet} />
          </div>
        </div>
        <div className='border-4 mt-4 md:w-4/12 sm:w-10/12' >
          Enter the TxHash:
          <input className='mt-2 w-10/12 text-center border-2 '
            placeholder='Enter the Crypto Transaction Hash'
            value={trxHash}
            onChange={(e) => { setTrxHash(e.target.value) }}  
          />
          <br></br>
          <br></br>
          <input type="checkbox" value={paidCheck} onChange={(e) => setPaidCheck(e.target.value)} 
          ></input> I have made the Crypto Payment
          <br></br>
          <br></br>
          <button className='rounded-full mb-7 py-3 px-5 text-[#e3d08f] text-xl bg-[#281309] border-2 border-[#867854] shadow-[#281309]-500/50 shadow-xl'
            onClick={() => { verifyTransaction() }} >Verify & Submit
          </button>
          <button className='ml-3 rounded-full mb-7 py-3 px-5 text-[#e3d08f] text-xl bg-[#281309] border-2 border-[#867854] shadow-[#281309]-500/50 shadow-xl'
            onClick={() => {alert("cancel")}} >Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
