const PaperBlock = (props: {id: string}) => {
  return (
    <div className="paper-block" contentEditable={false}>
      {props.id}
    </div>
  )
}

export default PaperBlock;