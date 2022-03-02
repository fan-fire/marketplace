const ERC721Mock = artifacts.require('ERC721Mock');
const ERC721WithERC2981Mock = artifacts.require('ERC721WithERC2981Mock');
const ERC1155Mock = artifacts.require('ERC1155Mock');
const ERC1155WithERC2981Mock = artifacts.require('ERC1155WithERC2981Mock');

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = async (deployer, network, accounts) => {
  // if (network !== 'development') {
  //   await sleep(60000);
  // }
  // // await sleep(60000);
  // // await deployer.deploy(ERC20Mock);
  // // let m = await ERC20Mock.deployed();
  // // console.log(m.address);
  // await deployer.deploy(ERC721Mock);
  // if (network !== 'development') {
  //   await sleep(60000);
  // }
  // await deployer.deploy(ERC721WithERC2981Mock);
  // if (network !== 'development') {
  //   await sleep(60000);
  // }
  // await deployer.deploy(ERC1155Mock);
  // if (network !== 'development') {
  //   await sleep(60000);
  // }
  // await deployer.deploy(ERC1155WithERC2981Mock);

  // if (network !== 'development') {
  //   await sleep(60000);
  // }
  // let erc721 = await ERC721Mock.deployed();
  // let erc721WithERC2981 = await ERC721WithERC2981Mock.deployed();
  // let erc1155 = await ERC1155Mock.deployed();
  // let erc1155WithERC2981 = await ERC1155WithERC2981Mock.deployed();

  // console.log(`ERC721Mock address: ${erc721.address}`);
  // console.log(`ERC721WithERC2981Mock addreess: ${erc721WithERC2981.address}`);
  // console.log(`ERC1155Mock address:e ${erc1155.address}`);
  // console.log(`ERC1155WithERC2981Mock addreses: ${erc1155WithERC2981.address}`);

  // for (let i = 0; i < 10; i++) {
  //   // if (network !== 'development') {
  //   //   await sleep(60000);
  //   // }
  //   // console.log('minting token', i);
  //   // await erc721.mint(accounts[1], { from: accounts[1] });
  //   if (network !== 'development') {
  //     await sleep(60000);
  //   }
  //   // await erc721WithERC2981.mint(accounts[1], { from: accounts[1] });
  //   // await erc1155.mint(accounts[1], { from: accounts[1] });
  //   // await erc1155WithERC2981.mint(accounts[1], { from: accounts[1] });
  // }
};
